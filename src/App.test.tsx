import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import App from './App';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from './components/EmailInput/EmailInput';
import { vi } from './i18n/vi';

/**
 * Integration tests for the wired application.
 *
 * The app is a single Vietnamese dashboard — no login, no routing. The service
 * singletons are mocked so the real App composition (ThemeProvider →
 * NotificationProvider → ToastContainer + DashboardPage) can be exercised
 * without network or WebSocket access. jsdom's default width (1024) is at the
 * desktop threshold, so the dashboard renders (not the viewport guard).
 */

jest.mock('./services/accountService', () => ({
  accountService: {
    checkAccount: jest.fn(),
    getAccount12h: jest.fn(),
    getVariables: jest.fn(),
    reinvite: jest.fn(),
  },
}));

jest.mock('./services/otpService', () => ({
  otpService: { readOTP: jest.fn() },
}));

jest.mock('./services/webSocketService', () => ({
  createWebSocketService: () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onMessage: jest.fn(),
    onStatusChange: jest.fn(),
    getStatus: () => 'disconnected',
  }),
  webSocketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onMessage: jest.fn(),
    onStatusChange: jest.fn(),
    getStatus: () => 'disconnected',
  },
}));

import { accountService } from './services/accountService';

const mockedCheckAccount = accountService.checkAccount as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(cleanup);

describe('App - single Vietnamese dashboard', () => {
  it('loads straight into the dashboard (brand + email field, no login)', () => {
    render(<App />);

    // The app bar brand and the email field are present; there is no login.
    expect(screen.getAllByText(vi.app.name).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('exposes the theme toggle in the app bar', () => {
    render(<App />);

    // Either label may show depending on the resolved initial theme.
    const toggle =
      screen.queryByRole('button', { name: vi.theme.toDark }) ??
      screen.queryByRole('button', { name: vi.theme.toLight });
    expect(toggle).not.toBeNull();
  });
});

describe('App - dashboard operations route into panels', () => {
  it('routes a successful account status result into its panel', async () => {
    mockedCheckAccount.mockResolvedValue({
      success: true,
      data: { email: 'user@example.com', status: 'active', plan: 'pro' },
    });

    render(<App />);

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    await waitFor(
      () =>
        expect(
          (screen.getByRole('button', {
            name: vi.actions.checkStatus,
          }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: EMAIL_VALIDATION_DEBOUNCE_MS + 500 },
    );

    fireEvent.click(screen.getByRole('button', { name: vi.actions.checkStatus }));

    const panel = screen.getByRole('region', { name: vi.panels.accountStatus });
    await waitFor(() =>
      expect(
        within(panel).getByTestId('account-status-badge').textContent,
      ).toBe('Đang hoạt động'),
    );
    expect(within(panel).getByTestId('account-email').textContent).toBe(
      'user@example.com',
    );
    expect(mockedCheckAccount).toHaveBeenCalledWith('user@example.com');
  });

  it('routes an account status API error into its panel', async () => {
    mockedCheckAccount.mockResolvedValue({
      success: false,
      error: 'Không tìm thấy tài khoản',
    });

    render(<App />);

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    await waitFor(
      () =>
        expect(
          (screen.getByRole('button', {
            name: vi.actions.checkStatus,
          }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: EMAIL_VALIDATION_DEBOUNCE_MS + 500 },
    );

    fireEvent.click(screen.getByRole('button', { name: vi.actions.checkStatus }));

    const panel = screen.getByRole('region', { name: vi.panels.accountStatus });
    await waitFor(() =>
      expect(within(panel).getByRole('alert').textContent).toBe(
        'Không tìm thấy tài khoản',
      ),
    );
  });
});
