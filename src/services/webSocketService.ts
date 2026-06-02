/**
 * WebSocket service for real-time account monitoring.
 *
 * Establishes and manages a native WebSocket connection to the ADES Support
 * monitoring endpoint:
 *
 *   `wss://api-2026-02.ades.support/socket.io/?email={email}&EIO=4&transport=websocket`
 *
 * Responsibilities (Requirements 7.2, 7.3, 7.6, 7.7, 7.8, 7.9):
 *  - `connect(email)` opens the connection within a 10-second window; failing
 *    to connect in time surfaces an `error` status (Requirements 7.2, 7.7).
 *  - `disconnect()` sends a close frame and transitions to `disconnected`
 *    (Requirements 7.8, 7.9).
 *  - Incoming messages are wrapped with an ISO 8601 timestamp and routed
 *    through the bounded queue from `src/utils/messageQueue.ts` (Requirement
 *    7.4, 7.5 via the queue's 500-message cap).
 *  - Connection lifecycle changes emit `connecting`/`connected`/`disconnected`/
 *    `error` transitions to registered status listeners (Requirements 7.3,
 *    7.6, 7.7).
 *
 * The implementation matches the `WebSocketService`, `WSMessage`, and
 * `ConnectionStatus` contracts defined in `src/types`.
 */
import type {
  ConnectionStatus,
  WebSocketService,
  WSMessage,
} from '../types';
import { appConfig } from '../utils/appConfig';
import { appendMessage, formatTimestamp } from '../utils/messageQueue';

/** Connect timeout enforced before surfacing an error status (Requirement 7.7). */
export const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Minimal structural type for the parts of the WebSocket API this service uses.
 * Declaring it locally avoids depending on DOM lib typings being present and
 * lets tests inject a mock implementation.
 */
export interface WebSocketLike {
  readyState: number;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** Constructor shape for a WebSocket implementation. */
export type WebSocketConstructor = new (url: string) => WebSocketLike;

/** WebSocket readyState constants (mirrors the WHATWG WebSocket spec). */
const WS_CLOSING = 2;
const WS_CLOSED = 3;

/** Options for {@link createWebSocketService}, primarily to aid testing. */
export interface WebSocketServiceOptions {
  /** WebSocket implementation to use (defaults to the global `WebSocket`). */
  readonly WebSocketImpl?: WebSocketConstructor;
  /** Connect timeout in milliseconds (defaults to {@link CONNECT_TIMEOUT_MS}). */
  readonly connectTimeoutMs?: number;
}

/**
 * Build the monitoring WebSocket URL for an email by deriving the `wss://`
 * origin from the configured API base URL (Requirement 7.2).
 */
export function buildSocketUrl(email: string): string {
  const wsOrigin = appConfig.apiBaseUrl.replace(/^http(s?):\/\//i, (_match, secure) =>
    secure ? 'wss://' : 'ws://',
  );
  const query = `email=${encodeURIComponent(email)}&EIO=4&transport=websocket`;
  return `${wsOrigin}/socket.io/?${query}`;
}

/**
 * Parse raw WebSocket frame data into structured content. JSON payloads are
 * parsed into objects; anything else is preserved as-is so the panel can render
 * the raw value (Requirement 7.4 records content verbatim).
 */
function parseContent(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * Create a {@link WebSocketService} instance.
 *
 * Each instance owns at most one active connection. Calling `connect` while a
 * connection exists tears down the previous one first.
 */
export function createWebSocketService(
  options: WebSocketServiceOptions = {},
): WebSocketService {
  const connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;

  let socket: WebSocketLike | null = null;
  let status: ConnectionStatus = 'disconnected';
  let connectTimer: ReturnType<typeof setTimeout> | null = null;

  // Bounded history of received messages, routed through the 500-cap queue.
  let messages: WSMessage[] = [];

  const messageListeners = new Set<(message: WSMessage) => void>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();

  const resolveWebSocketImpl = (): WebSocketConstructor => {
    const impl =
      options.WebSocketImpl ??
      (typeof WebSocket !== 'undefined'
        ? (WebSocket as unknown as WebSocketConstructor)
        : undefined);
    if (!impl) {
      throw new Error('No WebSocket implementation available.');
    }
    return impl;
  };

  const setStatus = (next: ConnectionStatus): void => {
    if (next === status) {
      return;
    }
    status = next;
    for (const listener of statusListeners) {
      listener(status);
    }
  };

  const clearConnectTimer = (): void => {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  };

  /** Detach handlers from a socket so late events cannot mutate state. */
  const detach = (target: WebSocketLike | null): void => {
    if (!target) {
      return;
    }
    target.onopen = null;
    target.onmessage = null;
    target.onclose = null;
    target.onerror = null;
  };

  const teardown = (): void => {
    clearConnectTimer();
    detach(socket);
    socket = null;
  };

  const connect: WebSocketService['connect'] = (email) => {
    // Replace any existing connection before starting a new one.
    if (socket) {
      const previous = socket;
      detach(previous);
      socket = null;
      if (previous.readyState !== WS_CLOSED && previous.readyState !== WS_CLOSING) {
        try {
          previous.close();
        } catch {
          // Ignore close failures on a connection we are discarding.
        }
      }
    }
    clearConnectTimer();
    messages = [];

    setStatus('connecting');

    const WebSocketImpl = resolveWebSocketImpl();
    const url = buildSocketUrl(email);
    const ws = new WebSocketImpl(url);
    socket = ws;

    // Enforce the 10-second connect timeout (Requirement 7.7).
    connectTimer = setTimeout(() => {
      connectTimer = null;
      // Only the still-connecting socket should be timed out.
      if (socket !== ws || status !== 'connecting') {
        return;
      }
      detach(ws);
      try {
        ws.close();
      } catch {
        // Ignore — we are abandoning this connection attempt.
      }
      socket = null;
      setStatus('error');
    }, connectTimeoutMs);

    ws.onopen = () => {
      if (socket !== ws) {
        return;
      }
      clearConnectTimer();
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      if (socket !== ws) {
        return;
      }
      const message: WSMessage = {
        timestamp: formatTimestamp(),
        content: parseContent(event.data),
      };
      // Route through the bounded queue (500-message cap, oldest evicted).
      messages = appendMessage(messages, message);
      for (const listener of messageListeners) {
        listener(message);
      }
    };

    ws.onerror = () => {
      if (socket !== ws) {
        return;
      }
      clearConnectTimer();
      setStatus('error');
    };

    ws.onclose = () => {
      if (socket !== ws) {
        return;
      }
      clearConnectTimer();
      socket = null;
      // Preserve a terminal `error` status (e.g. a failed handshake) rather
      // than masking it with the close-driven `disconnected` transition.
      if (status !== 'error') {
        setStatus('disconnected');
      }
    };
  };

  const disconnect: WebSocketService['disconnect'] = () => {
    const target = socket;
    teardown();

    if (target && target.readyState !== WS_CLOSED && target.readyState !== WS_CLOSING) {
      // close() sends a WebSocket close frame to the server (Requirement 7.9).
      try {
        target.close();
      } catch {
        // Ignore close failures; status is still moved to disconnected below.
      }
    }

    setStatus('disconnected');
  };

  const onMessage: WebSocketService['onMessage'] = (callback) => {
    messageListeners.add(callback);
  };

  const onStatusChange: WebSocketService['onStatusChange'] = (callback) => {
    statusListeners.add(callback);
  };

  const getStatus: WebSocketService['getStatus'] = () => status;

  return {
    connect,
    disconnect,
    onMessage,
    onStatusChange,
    getStatus,
  };
}

/**
 * Default shared WebSocket service instance backed by the global `WebSocket`.
 */
export const webSocketService: WebSocketService = createWebSocketService();
