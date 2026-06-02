import { useCallback, useEffect, useRef, useState } from 'react';

import { ActionButton } from '../../components/ActionButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FieldList } from '../../components/FieldList/FieldList';
import { DataTable } from '../../components/DataTable';
import { EmailInput } from '../../components/EmailInput';
import { Menu } from '../../components/Menu/Menu';
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
 * Unified, Vietnamese-first support console (Fluent 2, enterprise layout).
 *
 * Designed around the staff member's primary flow: enter the customer's email,
 * then either check the account status or reinvite. Secondary tools (12-hour
 * data, variables, OTP, real-time monitoring) live in a compact "Công cụ khác"
 * dropdown so the surface stays uncluttered. Result cards only appear after the
 * matching operation runs (OTP shows only on demand).
 */

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

  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

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

  // Monitoring lives in a panel that is only shown once started.
  const [monitorActive, setMonitorActive] = useState(false);
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
    setMonitorActive(true);
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

  const handleClear = useCallback(() => {
    setAccountStatus(IDLE);
    setAccount12h(IDLE);
    setVariables(IDLE);
    setReinviteState(IDLE);
    setOtpState(IDLE);
    setMonitorActive(false);
    setMonitorMessages([]);
    monitorRef.current?.disconnect();
  }, []);

  const actionsDisabled = !isEmailValid;

  // Secondary tools handled via the dropdown.
  const toolSelect = useCallback(
    (id: string) => {
      switch (id) {
        case '12h':
          void handleView12h();
          break;
        case 'variables':
          void handleGetVariables();
          break;
        case 'otp':
          void handleReadOtp();
          break;
        case 'monitor':
          handleStartMonitoring();
          break;
        default:
          break;
      }
    },
    [handleView12h, handleGetVariables, handleReadOtp, handleStartMonitoring],
  );

  // Which result cards to show (only ones that have been invoked).
  const hasAnyResult =
    accountStatus.status !== 'idle' ||
    account12h.status !== 'idle' ||
    variables.status !== 'idle' ||
    reinviteState.status !== 'idle' ||
    otpState.status !== 'idle' ||
    monitorActive;

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

      <main className="console" data-testid="dashboard-page">
        <section className="command-card">
          <h1 className="command-card__title">{vi.panels.accountStatus}</h1>
          <p className="command-card__subtitle">{vi.empty.noEmail}</p>

          <div className="command-card__field">
            <label className="command-card__field-label">{vi.email.label}</label>
            <EmailInput
              value={email}
              onChange={setEmail}
              onValidationChange={setIsEmailValid}
              placeholder={vi.email.placeholder}
            />
          </div>

          <div
            className="command-card__actions"
            role="group"
            aria-label="Thao tác tài khoản"
          >
            {/* Primary actions customers need most. */}
            <ActionButton
              label={vi.actions.checkStatus}
              onClick={handleCheckStatus}
              disabled={actionsDisabled}
              loading={accountStatus.status === 'loading'}
            />
            <ActionButton
              label={vi.actions.reinvite}
              onClick={handleReinviteClick}
              disabled={actionsDisabled}
              loading={reinviteState.status === 'loading'}
              variant="secondary"
            />

            {/* Secondary tools grouped to keep the surface clean. */}
            <Menu
              triggerLabel={vi.actions.moreTools}
              disabled={actionsDisabled}
              onSelect={toolSelect}
              items={[
                {
                  id: '12h',
                  label: vi.actions.view12h,
                  icon: '🕒',
                  loading: account12h.status === 'loading',
                  testId: 'tool-12h',
                },
                {
                  id: 'variables',
                  label: vi.actions.getVariables,
                  icon: '🔧',
                  loading: variables.status === 'loading',
                  testId: 'tool-variables',
                },
                {
                  id: 'otp',
                  label: vi.actions.readOtp,
                  icon: '🔑',
                  loading: otpState.status === 'loading',
                  testId: 'tool-otp',
                },
                {
                  id: 'monitor',
                  label: vi.actions.startMonitoring,
                  icon: '📡',
                  testId: 'tool-monitor',
                },
              ]}
            />

            <span className="command-card__spacer" />

            {hasAnyResult && (
              <button
                type="button"
                className="results__clear"
                onClick={handleClear}
              >
                {vi.actions.clear}
              </button>
            )}
          </div>
        </section>

        <section className="results" aria-label="Kết quả">
          {!hasAnyResult ? (
            <div className="results__placeholder">
              <span className="results__placeholder-icon" aria-hidden="true">
                🔍
              </span>
              <p>{vi.empty.resultsHint}</p>
            </div>
          ) : (
            <div className="results__list">
              {accountStatus.status !== 'idle' && (
                <ResultPanel
                  title={vi.panels.accountStatus}
                  loading={accountStatus.status === 'loading'}
                  error={
                    accountStatus.status === 'error'
                      ? accountStatus.error
                      : undefined
                  }
                >
                  {accountStatus.status === 'success' ? (
                    <FieldList
                      data={accountStatus.data}
                      label={vi.panels.accountStatus}
                      emptyMessage={vi.empty.accountStatus}
                    />
                  ) : (
                    <p className="panel-empty">{vi.empty.accountStatus}</p>
                  )}
                </ResultPanel>
              )}

              {reinviteState.status !== 'idle' && (
                <ResultPanel
                  title={vi.panels.reinvite}
                  loading={reinviteState.status === 'loading'}
                  error={
                    reinviteState.status === 'error'
                      ? reinviteState.error
                      : undefined
                  }
                >
                  {reinviteState.status === 'success' ? (
                    <p className="reinvite-message" data-testid="reinvite-message">
                      <span aria-hidden="true">✓</span>
                      {reinviteState.data}
                    </p>
                  ) : (
                    <p className="panel-empty">{vi.empty.initial}</p>
                  )}
                </ResultPanel>
              )}

              {otpState.status !== 'idle' && (
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
                          onClick={() =>
                            handleCopyOtp(otpState.data.otp as string)
                          }
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
              )}

              {account12h.status !== 'idle' && (
                <ResultPanel
                  title={vi.panels.account12h}
                  loading={account12h.status === 'loading'}
                  error={
                    account12h.status === 'error' ? account12h.error : undefined
                  }
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
              )}

              {variables.status !== 'idle' && (
                <ResultPanel
                  title={vi.panels.variables}
                  loading={variables.status === 'loading'}
                  error={
                    variables.status === 'error' ? variables.error : undefined
                  }
                >
                  {variables.status === 'success' ? (
                    <FieldList
                      data={variables.data}
                      label={vi.panels.variables}
                      emptyMessage={vi.empty.variables}
                    />
                  ) : (
                    <p className="panel-empty">{vi.empty.variables}</p>
                  )}
                </ResultPanel>
              )}

              {monitorActive && (
                <ResultPanel title={vi.panels.monitoring}>
                  <div className="monitor-controls" data-testid="monitor-controls">
                    <ActionButton
                      label={vi.actions.disconnect}
                      onClick={handleStopMonitoring}
                      disabled={
                        monitorStatus === 'disconnected' ||
                        monitorStatus === 'error'
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
              )}
            </div>
          )}
        </section>
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
