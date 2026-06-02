/**
 * WebSocket service contract and real-time monitoring data models.
 *
 * Covers the WebSocketService interface plus the message/connection models used
 * by the monitoring panel and bounded message queue (Requirements 7.x).
 */

/**
 * Connection lifecycle states for the monitoring WebSocket (Requirement 7.3,
 * 7.6, 7.7).
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * A message delivered over the WebSocket service callback (Requirement 7.4).
 */
export interface WSMessage {
  /** ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss) of when the message arrived. */
  timestamp: string;
  content: unknown;
}

/**
 * Manages real-time WebSocket connections for monitoring.
 */
export interface WebSocketService {
  connect(email: string): void;
  disconnect(): void;
  onMessage(callback: (message: WSMessage) => void): void;
  onStatusChange(callback: (status: ConnectionStatus) => void): void;
  getStatus(): ConnectionStatus;
}

/**
 * A monitoring message as stored in the bounded queue / monitor panel
 * (Requirements 7.1, 7.4, 7.5).
 */
export interface WebSocketMessage {
  id: string;
  /** ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss). */
  timestamp: string;
  rawContent: string;
  parsedContent?: unknown;
}

/**
 * State of the real-time monitoring session for an email (Requirement 7.x).
 */
export interface MonitorState {
  email: string;
  status: ConnectionStatus;
  messages: WebSocketMessage[];
  /** ISO 8601 timestamp of when the connection was established. */
  connectedAt?: string;
  /** ISO 8601 timestamp of when the connection was closed. */
  disconnectedAt?: string;
}
