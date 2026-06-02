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
 * Component tests for the enterprise DashboardPage.
 *
 * Primary actions (Kiểm tra trạng thái, Mời lại) are buttons; secondary tools
 * (Dữ liệu 12 giờ, Lấy biến dữ liệu, Đọc mã OTP, Bắt đầu theo dõi) live in the
 * "Công cụ khác" dropdown. Result cards only appear after their operation runs.
 *
 * Covers result routing (12.3, 12.4), result replacement (12.5), email
 * persistence (12.6), and the reinvite confirmation flow (5.2, 5.7).
 */

const VALID_EMAIL = 'user@example.com';

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

async function enterValidEmail(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Email address');
  await user.type(input, VALID_EMAIL);
  await waitFor(() =>
    expect(
      (screen.getByRole('button', {
        name: 'Kiểm tra trạng thái',
      }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
}

/** Open the "Công cụ khác" dropdown and click the tool with the given test id. */
async function selectTool(
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
) {
  await user.click(screen.getByRole('button', { name: 'Công cụ khác' }));
  await user.click(screen.getByTestId(testId));
}

afterEach(cleanup);

describe('DashboardPage - structure and gating', () => {
  it('shows the primary actions and the tools dropdown', () => {
    renderDashboard();

    expect(
      screen.getByRole('button', { name: 'Kiểm tra trạng thái' }),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Mời lại tài khoản' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Công cụ khác' })).not.toBeNull();
  });

  it('shows an empty placeholder until an operation runs', () => {
    renderDashboard();
    // No result regions are rendered before any operation.
    expect(screen.queryByRole('region', { name: 'Trạng thái tài khoản' })).toBeNull();
  });

  it('disables actions until a valid email is entered', async () => {
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
  it('routes a successful account status result into its panel (readable Vietnamese)', async () => {
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
    // The raw key "status" is shown as the Vietnamese label "Trạng thái",
    // and the value "active" as the badge "Đang hoạt động".
    await waitFor(() =>
      expect(within(panel).getByText('Trạng thái')).not.toBeNull(),
    );
    expect(within(panel).getByText('Đang hoạt động')).not.toBeNull();
    expect(accountService.checkAccount).toHaveBeenCalledWith(VALID_EMAIL);
  });

  it('routes an API error into the corresponding panel', async () => {
    const user = userEvent.setup();
    const accountService = makeAccountService({
      checkAccount: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'Không tìm thấy tài khoản' }),
    });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }));

    const panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });
    await waitFor(() =>
      expect(within(panel).getByRole('alert').textContent).toBe(
        'Không tìm thấy tài khoản',
      ),
    );
  });

  it('renders the OTP value only after the OTP tool is used', async () => {
    const user = userEvent.setup();
    const otpService = makeOtpService({
      readOTP: jest.fn().mockResolvedValue({ success: true, otp: '987654' }),
    });
    renderDashboard({ otpService });

    await enterValidEmail(user);
    // OTP panel is hidden until invoked on demand.
    expect(screen.queryByTestId('otp-value')).toBeNull();

    await selectTool(user, 'tool-otp');

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
    await selectTool(user, 'tool-12h');

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
      .mockResolvedValueOnce({ success: true, data: { teamName: 'Alpha' } })
      .mockResolvedValueOnce({ success: true, data: { teamName: 'Beta' } });
    const accountService = makeAccountService({ checkAccount });
    renderDashboard({ accountService });

    await enterValidEmail(user);

    const button = screen.getByRole('button', { name: 'Kiểm tra trạng thái' });

    await user.click(button);
    let panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });
    await waitFor(() => expect(within(panel).getByText('Alpha')).not.toBeNull());

    await user.click(button);
    panel = screen.getByRole('region', { name: 'Trạng thái tài khoản' });
    await waitFor(() => expect(within(panel).getByText('Beta')).not.toBeNull());

    // The previous result must be fully gone.
    expect(within(panel).queryByText('Alpha')).toBeNull();
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
    await selectTool(user, 'tool-variables');
    await selectTool(user, 'tool-otp');

    expect(input.value).toBe(VALID_EMAIL);
  });
});

describe('DashboardPage - reinvite confirmation flow (Req 5.2, 5.7)', () => {
  it('opens a dialog naming the email and issues the request on confirm', async () => {
    const user = userEvent.setup();
    const reinvite = jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Đã gửi lời mời' });
    const accountService = makeAccountService({ reinvite });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Mời lại tài khoản' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(VALID_EMAIL);
    expect(reinvite).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    await waitFor(() => expect(reinvite).toHaveBeenCalledWith(VALID_EMAIL));

    const panel = screen.getByRole('region', { name: 'Trạng thái mời lại' });
    await waitFor(() =>
      expect(within(panel).getByText('Đã gửi lời mời')).not.toBeNull(),
    );
  });

  it('cancelling the dialog issues no reinvite request', async () => {
    const user = userEvent.setup();
    const reinvite = jest.fn();
    const accountService = makeAccountService({ reinvite });
    renderDashboard({ accountService });

    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Mời lại tài khoản' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reinvite).not.toHaveBeenCalled();
  });
});

describe('DashboardPage - monitoring panel', () => {
  it('connects on Start Monitoring and renders streamed messages', async () => {
    const user = userEvent.setup();
    const monitor = makeMonitorService();
    renderDashboard({ createMonitor: () => monitor.service });

    await enterValidEmail(user);
    await selectTool(user, 'tool-monitor');
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
    await selectTool(user, 'tool-monitor');
    monitor.emitStatus('connected');

    await user.click(screen.getByRole('button', { name: 'Ngắt kết nối' }));
    expect(monitor.disconnect).toHaveBeenCalled();
  });
});
