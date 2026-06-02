import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import EmailInput from '../../components/EmailInput';
import ActionButton from '../../components/ActionButton';
import MonitorPanel from '../../components/MonitorPanel';
import { useNotifications } from '../../context/NotificationContext';
import { webSocketService } from '../../services/webSocketService';
import { appendMessage, MAX_QUEUE_SIZE } from '../../utils/messageQueue';
import type { ConnectionStatus, WebSocketService, WSMessage } from '../../types';

/**
 * Real-time monitoring page (design "MonitorPage", task 16.1).
 *
 * Wires the validated {@link EmailInput} and start/disconnect/retry controls to
 * the {@link WebSocketService} and renders incoming activity through
 * {@link MonitorPanel}. Behaviour map to Requirement 7:
 *
 *  - 7.1 / 7.5: incoming messages are appended through the bounded queue
 *    (`appendMessage`, capped at {@link MAX_QUEUE_SIZE} = 500), and the panel is
 *    given that cap so the oldest message is evicted once the limit is reached.
 *  - 7.2: starting monitoring calls `service.connect(email)`, which opens the
 *    `wss://…/socket.io/?email=…` endpoint.
 *  - 7.3 / 7.6: the connected/disconnected indicator is driven by the service's
 *    status callback and surfaced both in the panel and the controls.
 *  - 7.6: a server- or network-driven close raises a disconnection notification.
 *  - 7.7: a connect timeout (status `error`) shows an error message plus a
 *    Retry action.
 *  - 7.8 / 7.9: the Disconnect button calls `service.disconnect()`, sending a
 *    close frame and moving the indicator to disconnected.
 */
export interface MonitorPageProps {
  /**
   * WebSocket service to drive the monitor. Defaults to the shared singleton;
   * tests inject a mock implementation.
   */
  service?: WebSocketService;
}

/** Connect timeout/disconnection messages surfaced to the user. */
const CONNECT_TIMEOUT_MESSAGE =
  'Connection timeout: could not connect within 10 seconds. Use Retry to try again.';
const CONNECTION_ERROR_MESSAGE =
  'WebSocket connection error. Use Retry to try again.';
const DISCONNECTION_MESSAGE = 'WebSocket connection closed by the server.';

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 900,
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
};

const errorBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 12px',
  border: '1px solid #cf222e',
  borderRadius: 6,
  color: '#cf222e',
  backgroundColor: '#fff5f5',
};

export function MonitorPage({ service = webSocketService }: MonitorPageProps) {
  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    service.getStatus(),
  );
  const [errorMessage, setErrorMessage] = useState<string>(
    CONNECT_TIMEOUT_MESSAGE,
  );
  const [messages, setMessages] = useState<WSMessage[]>([]);

  const { showError, showInfo } = useNotifications();

  // The service's listener registration has no removal API, so the listeners
  // are registered exactly once per service and read mutable state via refs.
  const statusRef = useRef<ConnectionStatus>(status);
  statusRef.current = status;

  // Distinguishes a user-initiated disconnect (no notification, Req 7.9) from a
  // server/network-driven close (disconnection notification, Req 7.6).
  const manualDisconnectRef = useRef(false);

  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;

  useEffect(() => {
    let mounted = true;

    service.onStatusChange((next) => {
      if (!mounted) {
        return;
      }
      const previous = statusRef.current;
      setStatus(next);

      if (next === 'error') {
        // A failure while connecting is a connect timeout (Req 7.7); any other
        // transition to error is a transport-level connection error.
        const message =
          previous === 'connecting'
            ? CONNECT_TIMEOUT_MESSAGE
            : CONNECTION_ERROR_MESSAGE;
        setErrorMessage(message);
        showErrorRef.current(message);
      } else if (next === 'disconnected' && previous === 'connected') {
        if (manualDisconnectRef.current) {
          // User clicked Disconnect (Req 7.9) — no disconnection notice.
          manualDisconnectRef.current = false;
        } else {
          // Server/network closed the active connection (Req 7.6).
          showInfoRef.current(DISCONNECTION_MESSAGE);
        }
      }
    });

    service.onMessage((message) => {
      if (!mounted) {
        return;
      }
      // Bounded queue: cap at 500, evicting the oldest first (Req 7.1, 7.5).
      setMessages((current) =>
        appendMessage(current, message, MAX_QUEUE_SIZE),
      );
    });

    return () => {
      mounted = false;
    };
  }, [service]);

  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  const isActive = isConnecting || isConnected;

  const handleStart = useCallback(() => {
    if (!emailValid || isActive) {
      return;
    }
    // Reset the visible history for the new session (Req 7.1 fresh queue).
    setMessages([]);
    manualDisconnectRef.current = false;
    service.connect(email);
  }, [email, emailValid, isActive, service]);

  const handleDisconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    // close() sends a WebSocket close frame to the server (Req 7.8, 7.9).
    service.disconnect();
  }, [service]);

  return (
    <section style={pageStyle} aria-label="Real-Time Monitoring">
      <h1>Real-Time Monitoring</h1>

      <div style={controlsStyle}>
        <div style={{ flex: '1 1 280px', minWidth: 240 }}>
          <EmailInput
            value={email}
            onChange={setEmail}
            onValidationChange={setEmailValid}
            disabled={isActive}
            placeholder="account@example.com"
          />
        </div>

        <ActionButton
          label={isConnecting ? 'Connecting…' : 'Start Monitoring'}
          onClick={handleStart}
          loading={isConnecting}
          disabled={!emailValid || isActive}
          variant="primary"
        />

        <ActionButton
          label="Disconnect"
          onClick={handleDisconnect}
          disabled={!isActive}
          variant="danger"
        />
      </div>

      {status === 'error' && (
        <div style={errorBannerStyle} role="alert" data-testid="monitor-error">
          <span>{errorMessage}</span>
          <ActionButton
            label="Retry"
            onClick={handleStart}
            disabled={!emailValid}
            variant="primary"
          />
        </div>
      )}

      <MonitorPanel
        messages={messages}
        maxMessages={MAX_QUEUE_SIZE}
        status={status}
      />
    </section>
  );
}

export default MonitorPage;
