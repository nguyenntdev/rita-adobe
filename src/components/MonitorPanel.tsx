import { useMemo, type CSSProperties } from 'react';
import type { ConnectionStatus, WSMessage } from '../types';

/**
 * Real-time message display panel for the WebSocket monitor.
 *
 * Renders each received message alongside its ISO 8601 timestamp
 * (Requirement 7.4), a connected/disconnected status indicator
 * (Requirements 7.3, 7.6), and a visualization of how full the bounded
 * message queue is relative to its cap (Requirements 7.1, 7.5 — the cap itself
 * is enforced upstream in the message queue; this panel surfaces it).
 */
export interface MonitorPanelProps {
  /** Messages to display, oldest first (as produced by the bounded queue). */
  messages: WSMessage[];
  /** Maximum number of messages the queue retains (e.g. 500). */
  maxMessages: number;
  /** Current WebSocket connection status. */
  status: ConnectionStatus;
}

/**
 * Human-readable label and indicator color for each connection status.
 */
const STATUS_META: Record<
  ConnectionStatus,
  { label: string; color: string }
> = {
  connected: { label: 'Connected', color: '#1a7f37' },
  connecting: { label: 'Connecting…', color: '#9a6700' },
  disconnected: { label: 'Disconnected', color: '#57606a' },
  error: { label: 'Connection error', color: '#cf222e' },
};

/**
 * Renders the content of a message as a display string. Strings are shown
 * verbatim; everything else is JSON-stringified so structured payloads remain
 * legible. Values that cannot be serialized fall back to `String(content)`.
 */
function formatContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #d0d7de',
  borderRadius: 6,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid #d0d7de',
  gap: 12,
};

const statusStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 600,
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  maxHeight: 400,
  overflowY: 'auto',
};

const messageRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: '6px 12px',
  borderBottom: '1px solid #eaeef2',
  fontFamily: 'monospace',
  fontSize: 13,
};

const timestampStyle: CSSProperties = {
  color: '#57606a',
  whiteSpace: 'nowrap',
};

const contentStyle: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

/**
 * MonitorPanel displays live WebSocket messages with timestamps, a connection
 * status indicator, and a queue-capacity visualization.
 */
export function MonitorPanel({
  messages,
  maxMessages,
  status,
}: MonitorPanelProps) {
  const statusMeta = STATUS_META[status];
  const isConnected = status === 'connected';

  // Clamp the count to the cap so the visualization never exceeds 100%.
  const fillRatio = useMemo(() => {
    if (maxMessages <= 0) {
      return 0;
    }
    return Math.min(messages.length, maxMessages) / maxMessages;
  }, [messages.length, maxMessages]);

  return (
    <section style={panelStyle} aria-label="Real-time monitor">
      <header style={headerStyle}>
        <span
          style={{ ...statusStyle, color: statusMeta.color }}
          role="status"
          aria-live="polite"
          data-testid="monitor-status"
          data-status={status}
          data-connected={isConnected}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: statusMeta.color,
            }}
          />
          {statusMeta.label}
        </span>

        <span
          data-testid="monitor-capacity"
          data-count={messages.length}
          data-max={maxMessages}
          aria-label={`${messages.length} of ${maxMessages} messages`}
        >
          {messages.length} / {maxMessages} messages
        </span>
      </header>

      {/* Capacity bar visualizing how close the queue is to its cap. */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={maxMessages}
        aria-valuenow={Math.min(messages.length, maxMessages)}
        data-testid="monitor-capacity-bar"
        style={{ height: 4, backgroundColor: '#eaeef2' }}
      >
        <div
          style={{
            height: '100%',
            width: `${fillRatio * 100}%`,
            backgroundColor: fillRatio >= 1 ? '#cf222e' : '#0969da',
          }}
        />
      </div>

      {messages.length === 0 ? (
        <p
          data-testid="monitor-empty"
          style={{ padding: '12px', color: '#57606a', margin: 0 }}
        >
          No messages received yet.
        </p>
      ) : (
        <ul style={listStyle} data-testid="monitor-message-list">
          {messages.map((message, index) => (
            <li
              // Messages have no stable id; timestamp + index preserves the
              // queue's arrival order as the React key.
              key={`${message.timestamp}-${index}`}
              style={messageRowStyle}
              data-testid="monitor-message"
            >
              <time
                dateTime={message.timestamp}
                style={timestampStyle}
                data-testid="monitor-message-timestamp"
              >
                {message.timestamp}
              </time>
              <span style={contentStyle} data-testid="monitor-message-content">
                {formatContent(message.content)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MonitorPanel;
