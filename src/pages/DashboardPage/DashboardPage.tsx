import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { ActionButton } from '../../components/ActionButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable } from '../../components/DataTable';
import { EmailInput } from '../../components/EmailInput';
import { KeyValueDisplay } from '../../components/KeyValueDisplay';
import { MonitorPanel } from '../../components/MonitorPanel';
import { ResultPanel } from '../../components/ResultPanel';
import { useNotifications } from '../../context/NotificationContext';
import { accountService as defaultAccountService } from '../../services/accountService';
import { otpService as defaultOtpService } from '../../services/otpService';
import { createWebSocketService } from '../../services/webSocketService';
import { appendMessage, MAX_QUEUE_SIZE } from '../../utils/messageQueue';
import type {
  Account12hRecord,
  AccountService,
  ConnectionStatus,
  OTPService,
  WebSocketService,
  WSMessage,
} from '../../types';

/**
 * Unified account dashboard (design "DashboardPage", task 17.1).
 *
 * Presents a single, persisted {@link EmailInput} alongside quick-action
 * buttons for every account operation and a dedicated result panel for each:
 * Account Status, 12-Hour Data, Variables, Reinvite Status, OTP, and Monitoring
 * (Requirements 12.1, 12.2).
 *
 * Behaviour:
 *   - Each operation's success result is routed into its corresponding panel,
 *     and each failure renders the API error message in that same panel
 *     (Requirements 12.3, 12.4). Triggering an operation again first resets its
 *     panel to the loading state, so the previous result is fully replaced with
 *     no remnants (Requirement 12.5 / Property 13).
 *   - The email field value lives in this component's state and is never reset
 *     by any operation, so it persists across operations within the session
 *     until the user edits it (Requirement 12.6 / Property 12).
 *   - Reinvite is gated behind a {@link ConfirmDialog} that names the exact
 *     target email; cancelling issues no request.
 *   - Success/error feedback is also surfaced as toasts via the
 *     {@link useNotifications} context.
 *
 * The account/OTP services and the monitor factory are injectable (defaulting
 * to the real implementations) so the page can be exercised in isolation.
 */

/** Discriminated async state shared by the request-backed panels. */
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

const IDLE: AsyncState<never> = { status: 'idle' };

/** Fallback message used when an API error carries no reason. */
const UNKNOWN_ERROR = 'An unexpected error occurred.';

export interface DashboardPageProps {
  /** Account operations service (defaults to the shared accountService). */
  accountService?: AccountService;
  /** OTP service (defaults to the shared otpService). */
  otpService?: OTPService;
  /**
   * Factory producing the monitoring WebSocket service. Defaults to
   * {@link createWebSocketService} so each mounted dashboard owns its own
   * connection.
   */
  createMonitor?: () => WebSocketService;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const panelGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
};

const otpValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontFamily: 'monospace',
  color: '#111827',
};

export function DashboardPage({
  accountService = defaultAccountService,
  otpService = defaultOtpService,
  createMonitor = createWebSocketService,
}: DashboardPageProps = {}) {
  const { showSuccess, showError } = useNotifications();

  // Persisted email shared by every operation (Requirement 12.6 / Property 12).
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Per-panel result state. Replacing the whole state object on each operation
  // guarantees the prior result is dropped (Requirement 12.5 / Property 13).
  const [accountStatus, setAccountStatus] = useState<
    AsyncState<Record<string, unknown>>
  >(IDLE);
  const [account12h, setAccount12h] = useState<AsyncState<Account12hRecord[]>>(
    IDLE,
  );
  const [variables, setVariables] = useState<
    AsyncState<Record<string, unknown>>
  >(IDLE);
  const [reinviteState, setReinviteState] = useState<AsyncState<string>>(IDLE);
  // OTP success carries an optional value: absent means "no OTP found".
  const [otpState, setOtpState] = useState<AsyncState<{ otp?: string }>>(IDLE);

  // Reinvite confirmation dialog visibility.
  const [isReinviteDialogOpen, setIsReinviteDialogOpen] = useState(false);

  // Monitoring panel state.
  const [monitorMessages, setMonitorMessages] = useState<WSMessage[]>([]);
  const [monitorStatus, setMonitorStatus] =
    useState<ConnectionStatus>('disconnected');

  // One monitor service instance per mounted dashboard.
  const monitorRef = useRef<WebSocketService | null>(null);
  if (monitorRef.current === null) {
    monitorRef.current = createMonitor();
  }

  useEffect(() => {
    const monitor = monitorRef.current;
    if (!monitor) {
      return;
    }
    monitor.onMessage((message) => {
      setMonitorMessages((current) =>
        appendMessage(current, message, MAX_QUEUE_SIZE),
      );
    });
    monitor.onStatusChange((status) => {
      setMonitorStatus(status);
    });
    // Tear down the connection when the dashboard unmounts.
    return () => {
      monitor.disconnect();
    };
  }, []);

  const handleCheckStatus = useCallback(async () => {
    setAccountStatus({ status: 'loading' });
    const result = await accountService.checkAccount(email);
    if (result.success) {
      setAccountStatus({ status: 'success', data: result.data ?? {} });
      showSuccess('Account status check completed.');
    } else {
      const error = result.error ?? UNKNOWN_ERROR;
      setAccountStatus({ status: 'error', error });
      showError(`Account status check failed: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleView12h = useCallback(async () => {
    setAccount12h({ status: 'loading' });
    const result = await accountService.getAccount12h(email);
    if (result.success) {
      setAccount12h({ status: 'success', data: result.data ?? [] });
      showSuccess('12-hour data retrieval completed.');
    } else {
      const error = result.error ?? UNKNOWN_ERROR;
      setAccount12h({ status: 'error', error });
      showError(`12-hour data retrieval failed: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleGetVariables = useCallback(async () => {
    setVariables({ status: 'loading' });
    const result = await accountService.getVariables(email);
    if (result.success) {
      setVariables({ status: 'success', data: result.data ?? {} });
      showSuccess('Variable data retrieval completed.');
    } else {
      const error = result.error ?? UNKNOWN_ERROR;
      setVariables({ status: 'error', error });
      showError(`Variable data retrieval failed: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  // Reinvite opens a confirmation dialog; the request is only issued on confirm.
  const handleReinviteClick = useCallback(() => {
    setIsReinviteDialogOpen(true);
  }, []);

  const handleReinviteCancel = useCallback(() => {
    // Cancelling aborts the operation without changing any state (Req 5.7).
    setIsReinviteDialogOpen(false);
  }, []);

  const handleReinviteConfirm = useCallback(async () => {
    setIsReinviteDialogOpen(false);
    setReinviteState({ status: 'loading' });
    const result = await accountService.reinvite(email);
    if (result.success) {
      const message = result.message ?? `Reinvite sent to ${email}.`;
      setReinviteState({ status: 'success', data: message });
      showSuccess(`Reinvite completed: ${message}`);
    } else {
      const error = result.error ?? UNKNOWN_ERROR;
      setReinviteState({ status: 'error', error });
      showError(`Reinvite failed: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleReadOtp = useCallback(async () => {
    setOtpState({ status: 'loading' });
    const result = await otpService.readOTP(email);
    if (result.success) {
      setOtpState({ status: 'success', data: { otp: result.otp } });
      showSuccess('OTP read completed.');
    } else {
      const error = result.error ?? UNKNOWN_ERROR;
      setOtpState({ status: 'error', error });
      showError(`OTP read failed: ${error}`);
    }
  }, [otpService, email, showSuccess, showError]);

  const handleStartMonitoring = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) {
      return;
    }
    // Replace any prior session's messages so the panel reflects the new
    // connection only (Requirement 12.5 / Property 13).
    setMonitorMessages([]);
    monitor.connect(email);
  }, [email]);

  const handleStopMonitoring = useCallback(() => {
    monitorRef.current?.disconnect();
  }, []);

  // Buttons are enabled only for a valid email; loading is tracked per action
  // so each button reflects only its own in-flight request (Property 6).
  const actionsDisabled = !isEmailValid;

  return (
    <div style={containerStyle} data-testid="dashboard-page">
      <h1>Account Dashboard</h1>

      <div style={controlsStyle}>
        <EmailInput
          value={email}
          onChange={setEmail}
          onValidationChange={setIsEmailValid}
          placeholder="Enter an account email"
        />

        <div style={buttonRowStyle} role="group" aria-label="Account operations">
          <ActionButton
            label="Check Status"
            onClick={handleCheckStatus}
            disabled={actionsDisabled}
            loading={accountStatus.status === 'loading'}
          />
          <ActionButton
            label="View 12h Data"
            onClick={handleView12h}
            disabled={actionsDisabled}
            loading={account12h.status === 'loading'}
          />
          <ActionButton
            label="Get Variables"
            onClick={handleGetVariables}
            disabled={actionsDisabled}
            loading={variables.status === 'loading'}
          />
          <ActionButton
            label="Reinvite"
            onClick={handleReinviteClick}
            disabled={actionsDisabled}
            loading={reinviteState.status === 'loading'}
            variant="secondary"
          />
          <ActionButton
            label="Read OTP"
            onClick={handleReadOtp}
            disabled={actionsDisabled}
            loading={otpState.status === 'loading'}
          />
          <ActionButton
            label="Start Monitoring"
            onClick={handleStartMonitoring}
            disabled={actionsDisabled}
            loading={monitorStatus === 'connecting'}
          />
        </div>
      </div>

      <div style={panelGridStyle}>
        <ResultPanel
          title="Account Status"
          loading={accountStatus.status === 'loading'}
          error={
            accountStatus.status === 'error' ? accountStatus.error : undefined
          }
        >
          {accountStatus.status === 'success' ? (
            <KeyValueDisplay
              data={accountStatus.data}
              label="Account status"
              emptyMessage="No account status data available."
            />
          ) : null}
        </ResultPanel>

        <ResultPanel
          title="12-Hour Data"
          loading={account12h.status === 'loading'}
          error={account12h.status === 'error' ? account12h.error : undefined}
        >
          {account12h.status === 'success' ? (
            <DataTable
              records={account12h.data}
              label="12-hour data"
              emptyMessage="No data available for the specified account."
            />
          ) : null}
        </ResultPanel>

        <ResultPanel
          title="Variables"
          loading={variables.status === 'loading'}
          error={variables.status === 'error' ? variables.error : undefined}
        >
          {variables.status === 'success' ? (
            <KeyValueDisplay
              data={variables.data}
              label="Variable data"
              emptyMessage="No variable data available for the specified email."
            />
          ) : null}
        </ResultPanel>

        <ResultPanel
          title="Reinvite Status"
          loading={reinviteState.status === 'loading'}
          error={
            reinviteState.status === 'error' ? reinviteState.error : undefined
          }
        >
          {reinviteState.status === 'success' ? (
            <p data-testid="reinvite-message">{reinviteState.data}</p>
          ) : null}
        </ResultPanel>

        <ResultPanel
          title="OTP"
          loading={otpState.status === 'loading'}
          error={otpState.status === 'error' ? otpState.error : undefined}
        >
          {otpState.status === 'success' ? (
            otpState.data.otp !== undefined ? (
              <span data-testid="otp-value" style={otpValueStyle}>
                {otpState.data.otp}
              </span>
            ) : (
              <p data-testid="otp-empty">No OTP found for the specified email.</p>
            )
          ) : null}
        </ResultPanel>

        <ResultPanel title="Monitoring">
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            data-testid="monitor-controls"
          >
            <ActionButton
              label="Disconnect"
              onClick={handleStopMonitoring}
              disabled={
                monitorStatus === 'disconnected' || monitorStatus === 'error'
              }
              variant="danger"
            />
            <MonitorPanel
              messages={monitorMessages}
              maxMessages={MAX_QUEUE_SIZE}
              status={monitorStatus}
            />
          </div>
        </ResultPanel>
      </div>

      <ConfirmDialog
        isOpen={isReinviteDialogOpen}
        title="Confirm Reinvite"
        message={`Send a reinvite to ${email}?`}
        confirmLabel="Send Reinvite"
        cancelLabel="Cancel"
        onConfirm={handleReinviteConfirm}
        onCancel={handleReinviteCancel}
      />
    </div>
  );
}

export default DashboardPage;
