import { useCallback, useEffect, useRef, useState } from 'react';

import { ActionButton } from '../../components/ActionButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable } from '../../components/DataTable';
import { EmailInput } from '../../components/EmailInput';
import { KeyValueDisplay } from '../../components/KeyValueDisplay';
import { MonitorPanel } from '../../components/MonitorPanel';
import { ResultPanel } from '../../components/ResultPanel';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { useNotifications } from '../../context/NotificationContext';
import { accountService as defaultAccountService } from '../../services/accountService';
import { otpService as defaultOtpService } from '../../services/otpService';
import { createWebSocketService } from '../../services/webSocketService';
import { appendMessage, MAX_QUEUE_SIZE } from '../../utils/messageQueue';
import { vi } from '../../i18n/vi';
import type {
  Account12hRecord,
  AccountService,
  ConnectionStatus,
  OTPService,
  WebSocketService,
  WSMessage,
} from '../../types';
import './DashboardPage.css';

/**
 * Unified, Vietnamese-first account dashboard (Fluent 2 design).
 *
 * A single screen with a top app bar (brand + light/dark theme toggle), one
 * persisted email field with quick-action buttons, and a responsive grid of
 * dedicated result cards: Trạng thái tài khoản, Dữ liệu 12 giờ, Biến dữ liệu,
 * Trạng thái mời lại, Mã OTP, Theo dõi thời gian thực.
 *
 * Behaviour:
 *   - Each operation routes its success/error result into its own card and
 *     replaces any previous result there.
 *   - The email value persists across operations until the user edits it.
 *   - Reinvite is gated behind a confirmation dialog naming the exact email.
 *   - Success/error feedback is also surfaced as toasts.
 *
 * The services and monitor factory are injectable (defaulting to the real
 * implementations) so the page can be exercised in isolation.
 */

/** Discriminated async state shared by the request-backed panels. */
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

const IDLE: AsyncState<never> = { status: 'idle' };

export interface DashboardPageProps {
  accountService?: AccountService;
  otpService?: OTPService;
  createMonitor?: () => WebSocketService;
}

export function DashboardPage({
  accountService = defaultAccountService,
  otpService = defaultOtpService,
  createMonitor = createWebSocketService,
}: DashboardPageProps = {}) {
  const { showSuccess, showError } = useNotifications();

  // Persisted email shared by every operation.
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Per-panel result state; replacing the whole object drops prior results.
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
  const [otpState, setOtpState] = useState<AsyncState<{ otp?: string }>>(IDLE);

  const [isReinviteDialogOpen, setIsReinviteDialogOpen] = useState(false);

  // Monitoring panel state.
  const [monitorMessages, setMonitorMessages] = useState<WSMessage[]>([]);
  const [monitorStatus, setMonitorStatus] =
    useState<ConnectionStatus>('disconnected');

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
    monitor.onStatusChange((status) => setMonitorStatus(status));
    return () => {
      monitor.disconnect();
    };
  }, []);

  const handleCheckStatus = useCallback(async () => {
    setAccountStatus({ status: 'loading' });
    const result = await accountService.checkAccount(email);
    if (result.success) {
      setAccountStatus({ status: 'success', data: result.data ?? {} });
      showSuccess(vi.toast.checkStatusOk);
    } else {
      const error = result.error ?? vi.toast.unknownError;
      setAccountStatus({ status: 'error', error });
      showError(`${vi.toast.checkStatusFail}: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleView12h = useCallback(async () => {
    setAccount12h({ status: 'loading' });
    const result = await accountService.getAccount12h(email);
    if (result.success) {
      setAccount12h({ status: 'success', data: result.data ?? [] });
      showSuccess(vi.toast.view12hOk);
    } else {
      const error = result.error ?? vi.toast.unknownError;
      setAccount12h({ status: 'error', error });
      showError(`${vi.toast.view12hFail}: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleGetVariables = useCallback(async () => {
    setVariables({ status: 'loading' });
    const result = await accountService.getVariables(email);
    if (result.success) {
      setVariables({ status: 'success', data: result.data ?? {} });
      showSuccess(vi.toast.variablesOk);
    } else {
      const error = result.error ?? vi.toast.unknownError;
      setVariables({ status: 'error', error });
      showError(`${vi.toast.variablesFail}: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleReinviteClick = useCallback(() => {
    setIsReinviteDialogOpen(true);
  }, []);

  const handleReinviteCancel = useCallback(() => {
    setIsReinviteDialogOpen(false);
  }, []);

  const handleReinviteConfirm = useCallback(async () => {
    setIsReinviteDialogOpen(false);
    setReinviteState({ status: 'loading' });
    const result = await accountService.reinvite(email);
    if (result.success) {
      const message = result.message ?? vi.toast.reinviteOk;
      setReinviteState({ status: 'success', data: message });
      showSuccess(message);
    } else {
      const error = result.error ?? vi.toast.unknownError;
      setReinviteState({ status: 'error', error });
      showError(`${vi.toast.reinviteFail}: ${error}`);
    }
  }, [accountService, email, showSuccess, showError]);

  const handleReadOtp = useCallback(async () => {
    setOtpState({ status: 'loading' });
    const result = await otpService.readOTP(email);
    if (result.success) {
      setOtpState({ status: 'success', data: { otp: result.otp } });
      showSuccess(vi.toast.otpOk);
    } else {
      const error = result.error ?? vi.toast.unknownError;
      setOtpState({ status: 'error', error });
      showError(`${vi.toast.otpFail}: ${error}`);
    }
  }, [otpService, email, showSuccess, showError]);

  const handleStartMonitoring = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) {
      return;
    }
    setMonitorMessages([]);
    monitor.connect(email);
  }, [email]);

  const handleStopMonitoring = useCallback(() => {
    monitorRef.current?.disconnect();
  }, []);

  const handleCopyOtp = useCallback(
    async (otp: string) => {
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error('clipboard unavailable');
        }
        await navigator.clipboard.writeText(otp);
        showSuccess(vi.toast.otpCopied);
      } catch {
        showError(vi.toast.otpCopyFail);
      }
    },
    [showSuccess, showError],
  );

  const actionsDisabled = !isEmailValid;

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar__brand">
          <span className="app-bar__logo" aria-hidden="true">
            R
          </span>
          <div>
            <div className="app-bar__title">{vi.app.name}</div>
            <div className="app-bar__tagline">{vi.app.tagline}</div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="dashboard" data-testid="dashboard-page">
        <section className="dashboard__command">
          <div className="dashboard__command-header">
            <h1 className="dashboard__command-title">{vi.app.tagline}</h1>
            <p className="dashboard__command-hint">{vi.empty.initial}</p>
          </div>

          <div className="dashboard__email">
            <EmailInput
              value={email}
              onChange={setEmail}
              onValidationChange={setIsEmailValid}
              placeholder={vi.email.placeholder}
            />
          </div>

          <div
            className="dashboard__actions"
            role="group"
            aria-label="Thao tác tài khoản"
          >
            <ActionButton
              label={vi.actions.checkStatus}
              onClick={handleCheckStatus}
              disabled={actionsDisabled}
              loading={accountStatus.status === 'loading'}
            />
            <ActionButton
              label={vi.actions.view12h}
              onClick={handleView12h}
              disabled={actionsDisabled}
              loading={account12h.status === 'loading'}
              variant="secondary"
            />
            <ActionButton
              label={vi.actions.getVariables}
              onClick={handleGetVariables}
              disabled={actionsDisabled}
              loading={variables.status === 'loading'}
              variant="secondary"
            />
            <ActionButton
              label={vi.actions.reinvite}
              onClick={handleReinviteClick}
              disabled={actionsDisabled}
              loading={reinviteState.status === 'loading'}
              variant="secondary"
            />
            <ActionButton
              label={vi.actions.readOtp}
              onClick={handleReadOtp}
              disabled={actionsDisabled}
              loading={otpState.status === 'loading'}
              variant="secondary"
            />
            <ActionButton
              label={vi.actions.startMonitoring}
              onClick={handleStartMonitoring}
              disabled={actionsDisabled}
              loading={monitorStatus === 'connecting'}
              variant="secondary"
            />
          </div>
        </section>

        <div className="dashboard__grid">
          <ResultPanel
            title={vi.panels.accountStatus}
            loading={accountStatus.status === 'loading'}
            error={
              accountStatus.status === 'error' ? accountStatus.error : undefined
            }
          >
            {accountStatus.status === 'success' ? (
              <KeyValueDisplay
                data={accountStatus.data}
                label={vi.panels.accountStatus}
                emptyMessage={vi.empty.accountStatus}
              />
            ) : (
              <p className="panel-empty">{vi.empty.accountStatus}</p>
            )}
          </ResultPanel>

          <ResultPanel
            title={vi.panels.account12h}
            loading={account12h.status === 'loading'}
            error={account12h.status === 'error' ? account12h.error : undefined}
          >
            {account12h.status === 'success' ? (
              <DataTable
                records={account12h.data}
                label={vi.panels.account12h}
                emptyMessage={vi.empty.account12h}
              />
            ) : (
              <p className="panel-empty">{vi.empty.account12h}</p>
            )}
          </ResultPanel>

          <ResultPanel
            title={vi.panels.variables}
            loading={variables.status === 'loading'}
            error={variables.status === 'error' ? variables.error : undefined}
          >
            {variables.status === 'success' ? (
              <KeyValueDisplay
                data={variables.data}
                label={vi.panels.variables}
                emptyMessage={vi.empty.variables}
              />
            ) : (
              <p className="panel-empty">{vi.empty.variables}</p>
            )}
          </ResultPanel>

          <ResultPanel
            title={vi.panels.reinvite}
            loading={reinviteState.status === 'loading'}
            error={
              reinviteState.status === 'error' ? reinviteState.error : undefined
            }
          >
            {reinviteState.status === 'success' ? (
              <p className="reinvite-message" data-testid="reinvite-message">
                {reinviteState.data}
              </p>
            ) : (
              <p className="panel-empty">{vi.empty.initial}</p>
            )}
          </ResultPanel>

          <ResultPanel
            title={vi.panels.otp}
            loading={otpState.status === 'loading'}
            error={otpState.status === 'error' ? otpState.error : undefined}
          >
            {otpState.status === 'success' ? (
              otpState.data.otp !== undefined ? (
                <div className="otp-result">
                  <span className="otp-result__value" data-testid="otp-value">
                    {otpState.data.otp}
                  </span>
                  <ActionButton
                    label={vi.actions.copy}
                    onClick={() => handleCopyOtp(otpState.data.otp as string)}
                    variant="secondary"
                  />
                </div>
              ) : (
                <p className="panel-empty" data-testid="otp-empty">
                  {vi.empty.otp}
                </p>
              )
            ) : (
              <p className="panel-empty">{vi.empty.otp}</p>
            )}
          </ResultPanel>

          <ResultPanel title={vi.panels.monitoring}>
            <div className="monitor-controls" data-testid="monitor-controls">
              <ActionButton
                label={vi.actions.disconnect}
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
      </main>

      <ConfirmDialog
        isOpen={isReinviteDialogOpen}
        title={vi.reinviteDialog.title}
        message={vi.reinviteDialog.message(email)}
        confirmLabel={vi.reinviteDialog.confirm}
        cancelLabel={vi.reinviteDialog.cancel}
        onConfirm={handleReinviteConfirm}
        onCancel={handleReinviteCancel}
      />
    </div>
  );
}

export default DashboardPage;
