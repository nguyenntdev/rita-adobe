/**
 * Unit/integration tests for the WebSocket service lifecycle (Task 7.5).
 *
 * A mock WebSocket implementation is injected via `createWebSocketService`'s
 * `WebSocketImpl` option, and Jest fake timers drive the 10-second connect
 * timeout. The tests verify:
 *  - the connect endpoint URL (Requirement 7.2),
 *  - the 10s connect-timeout `error` status (Requirement 7.7),
 *  - `disconnect()` sends a close frame (Requirement 7.9),
 *  - connected/disconnected/error status transitions (Requirements 7.6, 7.7).
 */
import {
  CONNECT_TIMEOUT_MS,
  buildSocketUrl,
  createWebSocketService,
  type WebSocketLike,
} from './webSocketService';

/** WebSocket readyState constants (mirrors the WHATWG WebSocket spec). */
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

/**
 * Minimal mock WebSocket implementing the `WebSocketLike` contract the service
 * depends on. Records the constructed URL and close calls, and exposes helpers
 * to simulate server-driven lifecycle events.
 */
class MockWebSocket implements WebSocketLike {
  /** Every instance constructed during a test, in creation order. */
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState: number = WS_CONNECTING;
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = WS_CLOSED;
  }

  /** Simulate the connection successfully opening. */
  simulateOpen(): void {
    this.readyState = WS_OPEN;
    this.onopen?.({});
  }

  /** Simulate an inbound frame. */
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data });
  }

  /** Simulate the server/network closing the connection. */
  simulateClose(): void {
    this.readyState = WS_CLOSED;
    this.onclose?.({});
  }

  /** Simulate a transport-level error. */
  simulateError(): void {
    this.onerror?.({});
  }
}

const EMAIL = 'user@example.com';

const createService = () =>
  createWebSocketService({ WebSocketImpl: MockWebSocket });

beforeEach(() => {
  MockWebSocket.instances = [];
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('buildSocketUrl', () => {
  it('builds the socket.io endpoint with the email/EIO/transport query (Req 7.2)', () => {
    expect(buildSocketUrl(EMAIL)).toBe(
      'wss://api-2026-02.ades.support/socket.io/?email=user%40example.com&EIO=4&transport=websocket',
    );
  });
});

describe('connect', () => {
  it('opens a WebSocket against the monitoring endpoint URL (Req 7.2)', () => {
    const service = createService();

    service.connect(EMAIL);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'wss://api-2026-02.ades.support/socket.io/?email=user%40example.com&EIO=4&transport=websocket',
    );
  });

  it('transitions disconnected -> connecting -> connected on open (Req 7.3, 7.6)', () => {
    const service = createService();
    const transitions: string[] = [];
    service.onStatusChange((status) => transitions.push(status));

    expect(service.getStatus()).toBe('disconnected');

    service.connect(EMAIL);
    expect(service.getStatus()).toBe('connecting');

    MockWebSocket.instances[0].simulateOpen();
    expect(service.getStatus()).toBe('connected');

    expect(transitions).toEqual(['connecting', 'connected']);
  });

  it('clears the connect timeout once the connection opens (Req 7.7)', () => {
    const service = createService();

    service.connect(EMAIL);
    MockWebSocket.instances[0].simulateOpen();
    expect(service.getStatus()).toBe('connected');

    // Advancing past the timeout window must NOT flip a connected socket to error.
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(service.getStatus()).toBe('connected');
  });
});

describe('connect timeout (Req 7.7)', () => {
  it('surfaces an error status when the connection is not open within 10s', () => {
    const service = createService();
    const transitions: string[] = [];
    service.onStatusChange((status) => transitions.push(status));

    service.connect(EMAIL);
    expect(service.getStatus()).toBe('connecting');

    // Just before the 10s boundary the status is still connecting.
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(service.getStatus()).toBe('connecting');

    // At the boundary the timeout fires and surfaces an error.
    jest.advanceTimersByTime(1);
    expect(service.getStatus()).toBe('error');
    expect(transitions).toEqual(['connecting', 'error']);
  });

  it('closes the abandoned socket when the connect timeout fires', () => {
    const service = createService();

    service.connect(EMAIL);
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);

    expect(MockWebSocket.instances[0].closeCalls).toHaveLength(1);
  });
});

describe('disconnect (Req 7.9)', () => {
  it('sends a close frame and transitions to disconnected on an open connection', () => {
    const service = createService();
    const transitions: string[] = [];
    service.onStatusChange((status) => transitions.push(status));

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateOpen();
    expect(service.getStatus()).toBe('connected');

    service.disconnect();

    // close() sends the WebSocket close frame to the server (Req 7.9).
    expect(socket.closeCalls).toHaveLength(1);
    expect(service.getStatus()).toBe('disconnected');
    expect(transitions).toEqual(['connecting', 'connected', 'disconnected']);
  });

  it('does not invoke close again on an already-closed socket', () => {
    const service = createService();

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateClose();
    expect(service.getStatus()).toBe('disconnected');

    service.disconnect();

    // The socket was already closed by the server event, so no extra close frame.
    expect(socket.closeCalls).toHaveLength(0);
    expect(service.getStatus()).toBe('disconnected');
  });
});

describe('status transitions on server/transport events (Req 7.6, 7.7)', () => {
  it('moves to disconnected when the server closes an active connection', () => {
    const service = createService();
    const transitions: string[] = [];
    service.onStatusChange((status) => transitions.push(status));

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateClose();

    expect(service.getStatus()).toBe('disconnected');
    expect(transitions).toEqual(['connecting', 'connected', 'disconnected']);
  });

  it('moves to error on a transport error (Req 7.7)', () => {
    const service = createService();

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateError();

    expect(service.getStatus()).toBe('error');
  });

  it('preserves a terminal error status even after a subsequent close event', () => {
    const service = createService();
    const transitions: string[] = [];
    service.onStatusChange((status) => transitions.push(status));

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateError();
    socket.simulateClose();

    // The close-driven `disconnected` transition must not mask the error.
    expect(service.getStatus()).toBe('error');
    expect(transitions).toEqual(['connecting', 'error']);
  });
});

describe('message handling', () => {
  it('delivers received messages with an ISO 8601 timestamp (Req 7.4)', () => {
    const service = createService();
    const received: Array<{ timestamp: string; content: unknown }> = [];
    service.onMessage((message) => received.push(message));

    service.connect(EMAIL);
    const socket = MockWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage(JSON.stringify({ event: 'ping' }));

    expect(received).toHaveLength(1);
    expect(received[0].content).toEqual({ event: 'ping' });
    expect(received[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});
