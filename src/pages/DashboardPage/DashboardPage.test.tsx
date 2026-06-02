import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NotificationProvider } from '../../context/NotificationContext';
import { ThemeProvider } from '../../context/ThemeContext';
import type {
  AccountService,
  ConnectionStatus,
  OTPService,
  WebSocketService,
  WSMessage,
} from '../../types';
import { DashboardPage } from './DashboardPage';

/**
 * Unit/component tests for the DashboardPage (task 17.1).
 *
 * Covers:
 *   - Quick-action buttons exist for every operation and are gated on a valid
 *     email (Requirements 12.1, 12.2).
 *   - Each operation's success/error result is routed into its dedicated panel
 *     (Requirements 12.3, 12.4).
 *   - Re-running an operation replaces the prior panel result (Requirement 12.5).
 *   - The email field persists across operations (Requirement 12.6).
 *   - Reinvite is gated behind a confirmation dialog naming the email; cancel
 *     issues no request (Requirements 5.2, 5.7).
 *
 * Property 12 / 13 are validated separately by tasks 17.2 / 17.3.
 */

const VALID_EMAIL = 'user@example.com';

/** Build a stub AccountService whose methods can be overridden per test. */
function makeAccountService(
  overrides: Partial<AccountService> = {},
): AccountService {
  return {
    checkAccount: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getAccount12h: jest.fn().mockResolvedValue({ success: true, data: [] }),
    getVariables: jest.fn().mockResolvedValue({ success: true, data: {} }),
    reinvite: jest.fn().mockResolvedValue({ success: true, message: 'sent' }),
    ...overrides,
  };
}

function makeOtpService(overrides: Partial<OTPService> = {}): OTPService {
  return {
    readOTP: jest.fn().mockResolvedValue({ success: true, otp: '123456' }),
    ...overrides,
  };
}

/** A controllable mock WebSocket service for the monitoring panel. */
function makeMonitorService(): {
  service: WebSocketService;
  emitMessage: (message: WSMessage) => void;
  emitStatus: (status: ConnectionStatus) => void;
  connect: jest.Mock;
  disconnect: jest.Mock;
} {
  let messageCb: ((m: WSMessage) => void) | null = null;
  let statusCb: ((s: ConnectionStatus) => void) | null = null;
  const connect = jest.fn();
  const disconnect = jest.fn();
  const service: WebSocketService = {
    connect,
    disconnect,
    onMessage: (cb) => {
      messageCb = cb;
    },
    onStatusChange: (cb) => {
      statusCb = cb;
    },
    getStatus: () => 'disconnected',
  };
  return {
    service,
    emitMessage: (message) => act(() => messageCb?.(message)),
    emitStatus: (status) => act(() => statusCb?.(status)),
    connect,
    disconnect,
  };
}

function renderDashboard(props: Parameters<typeof DashboardPage>[0] = {}) {
  return render(
    <ThemeProvider>
      <NotificationProvider>
        <DashboardPage {...props} />
      </NotificationProvider>
    </ThemeProvider>,
  );
}

/** Type a valid email and wait for the action buttons to become enabled. */
async function enterValidEmail(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Email address');
  await user.type(input, VALID_EMAIL);
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Kiểm tra trạng thái' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
}

afterEach(cleanup);

describe('DashboardPage - structure and gating (Req 12.1, 12.2)', () => {
  it('renders all six quick-action buttons and result panels', () => {
    renderDashboard();

    for (const label of [
      'Kiểm tra trạng thái',
      'Dữ liệu 12 giờ',
      'Lấy biến dữ liệu',
      'Mời lại',
      'Đọc mã OTP',
      'Bắt đầu theo dõi',
    ]) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }

    for (const title of [
      'Trạng thái tài khoản',
      'Dữ liệu 12 giờ',
      'Biến dữ liệu',
      'Trạng thái mời lại',
      'Mã OTP',
      'Theo dõi thời gian thực',
    ]) {
      expect(screen.getByRole('heading', { name: title })).not.toBeNull();
    }
  });

  it('disables operation buttons until a valid email is entered', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const checkButton = screen.getByRole('button', {
      name: 'Kiểm tra trạng thái',
    }) as HTMLButtonElement;
    expect(checkButton.disabled).toBe(true);

    await enterValidEmail(user);
    expect(checkButton.disabled).toBe(false);
  });
});

describe('DashboardPage - result routing (Req 12.3, 12.4)', () => {
  it('routes a successful account status result into its panel', async () => {
    const user = userEvent.setup();
    const accountService = makeAccountService({
      checkAccount: jest
        .fn()
        .mockResolvedValue({ success: true, data: { status: 'active' } }),
    });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }));

    const panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });
    await waitFor(() =>
      expect(within(panel).getByText('status')).not.toBeNull(),
    );
    expect(within(panel).getByText('active')).not.toBeNull();
    expect(accountService.checkAccount).toHaveBeenCalledWith(VALID_EMAIL);
  });

  it('routes an API error into the corresponding panel', async () => {
    const user = userEvent.setup();
    const accountService = makeAccountService({
      checkAccount: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'Account not found' }),
    });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }));

    const panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });
    await waitFor(() =>
      expect(within(panel).getByRole('alert').textContent).toBe(
        'Account not found',
      ),
    );
  });

  it('renders the OTP value at >=18px in its panel', async () => {
    const user = userEvent.setup();
    const otpService = makeOtpService({
      readOTP: jest.fn().mockResolvedValue({ success: true, otp: '987654' }),
    });
    renderDashboard({ otpService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Đọc mã OTP' }));

    const otp = await screen.findByTestId('otp-value');
    expect(otp.textContent).toBe('987654');
  });

  it('shows the empty 12-hour state when no records are returned', async () => {
    const user = userEvent.setup();
    const accountService = makeAccountService({
      getAccount12h: jest.fn().mockResolvedValue({ success: true, data: [] }),
    });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Dữ liệu 12 giờ' }));

    const panel = screen.getByRole('region', { name: 'Dữ liệu 12 giờ' });
    await waitFor(() =>
      expect(within(panel).getByTestId('data-table-empty')).not.toBeNull(),
    );
  });
});

describe('DashboardPage - result replacement (Req 12.5)', () => {
  it('replaces a prior panel result on the next operation', async () => {
    const user = userEvent.setup();
    const checkAccount = jest
      .fn()
      .mockResolvedValueOnce({ success: true, data: { first: '1' } })
      .mockResolvedValueOnce({ success: true, data: { second: '2' } });
    const accountService = makeAccountService({ checkAccount });
    renderDashboard({ accountService });

    await enterValidEmail(user);

    const button = screen.getByRole('button', { name: 'Kiểm tra trạng thái' });
    const panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });

    await user.click(button);
    await waitFor(() => expect(within(panel).getByText('first')).not.toBeNull());

    await user.click(button);
    await waitFor(() =>
      expect(within(panel).getByText('second')).not.toBeNull(),
    );

    // The previous result must be fully gone (Property 13).
    expect(within(panel).queryByText('first')).toBeNull();
  });
});

describe('DashboardPage - email persistence (Req 12.6)', () => {
  it('keeps the entered email across multiple operations', async () => {
    const user = userEvent.setup();
    const accountService = makeAccountService();
    const otpService = makeOtpService();
    renderDashboard({ accountService, otpService });

    await enterValidEmail(user);
    const input = screen.getByLabelText('Email address') as HTMLInputElement;

    await user.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }));
    await user.click(screen.getByRole('button', { name: 'Lấy biến dữ liệu' }));
    await user.click(screen.getByRole('button', { name: 'Đọc mã OTP' }));

    expect(input.value).toBe(VALID_EMAIL);
  });
});

describe('DashboardPage - reinvite confirmation flow (Req 5.2, 5.7)', () => {
  it('opens a dialog naming the email and issues the request on confirm', async () => {
    const user = userEvent.setup();
    const reinvite = jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Reinvite sent' });
    const accountService = makeAccountService({ reinvite });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Mời lại' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(VALID_EMAIL);
    expect(reinvite).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    await waitFor(() => expect(reinvite).toHaveBeenCalledWith(VALID_EMAIL));

    const panel = screen.getByRole('region', { name: 'Trạng thái mời lại' });
    await waitFor(() =>
      expect(within(panel).getByText('Reinvite sent')).not.toBeNull(),
    );
  });

  it('cancelling the dialog issues no reinvite request', async () => {
    const user = userEvent.setup();
    const reinvite = jest.fn();
    const accountService = makeAccountService({ reinvite });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Mời lại' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reinvite).not.toHaveBeenCalled();
  });
});

describe('DashboardPage - monitoring panel (Req 12.1)', () => {
  it('connects on Start Monitoring and renders streamed messages', async () => {
    const user = userEvent.setup();
    const monitor = makeMonitorService();
    renderDashboard({ createMonitor: () => monitor.service });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Bắt đầu theo dõi' }));
    expect(monitor.connect).toHaveBeenCalledWith(VALID_EMAIL);

    monitor.emitStatus('connected');
    monitor.emitMessage({ timestamp: '2026-02-01T10:00:00', content: 'hello' });

    const panel = screen.getByRole('region', { name: 'Theo dõi thời gian thực' });
    await waitFor(() =>
      expect(within(panel).getByText('hello')).not.toBeNull(),
    );
  });

  it('disconnects when the Disconnect button is clicked', async () => {
    const user = userEvent.setup();
    const monitor = makeMonitorService();
    renderDashboard({ createMonitor: () => monitor.service });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Bắt đầu theo dõi' }));
    monitor.emitStatus('connected');

    await user.click(screen.getByRole('button', { name: 'Ngắt kết nối' }));
    expect(monitor.disconnect).toHaveBeenCalled();
  });
});
