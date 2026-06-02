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

/**
 * End-to-end integration tests for the wired application.
 *
 * The app has no login gate: the dashboard is reachable directly. The service
 * singletons are mocked so the real App composition (NotificationProvider →
 * Router → MainLayout → pages) can be exercised without network or WebSocket
 * access. Covered:
 *   - the app loads straight into the dashboard with no login redirect
 *   - dashboard operations route their success/error results into the
 *     corresponding panels (Req 12.3, 12.4)
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

// A no-op WebSocket service so the dashboard's monitor wiring is inert.
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

function gotoPath(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  gotoPath('/');
});

describe('App routing - no login gate', () => {
  it('loads straight into the dashboard with no login redirect', () => {
    gotoPath('/');
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Account Dashboard' }),
    ).toBeInTheDocument();
    // There is no login interface.
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('renders a deep-linked page directly (e.g. Account Status Check)', () => {
    gotoPath('/account/check');
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Account Status Check' }),
    ).toBeInTheDocument();
  });
});

describe('App dashboard operations (Req 12.3, 12.4)', () => {
  it('routes a successful account status result into the Account Status panel', async () => {
    mockedCheckAccount.mockResolvedValue({
      success: true,
      data: { status: 'active', plan: 'pro' },
    });

    gotoPath('/');
    render(<App />);

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    await waitFor(
      () =>
        expect(
          (screen.getByRole('button', {
            name: 'Check Status',
          }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: EMAIL_VALIDATION_DEBOUNCE_MS + 500 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }));

    const panel = screen.getByRole('region', { name: 'Account Status' });
    await waitFor(() =>
      expect(within(panel).getByText('status')).toBeInTheDocument(),
    );
    expect(within(panel).getByText('active')).toBeInTheDocument();
    expect(mockedCheckAccount).toHaveBeenCalledWith('user@example.com');
  });

  it('routes an account status API error into the Account Status panel', async () => {
    mockedCheckAccount.mockResolvedValue({
      success: false,
      error: 'Account not found',
    });

    gotoPath('/');
    render(<App />);

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    await waitFor(
      () =>
        expect(
          (screen.getByRole('button', {
            name: 'Check Status',
          }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: EMAIL_VALIDATION_DEBOUNCE_MS + 500 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }));

    const panel = screen.getByRole('region', { name: 'Account Status' });
    await waitFor(() =>
      expect(within(panel).getByRole('alert').textContent).toBe(
        'Account not found',
      ),
    );
  });
});
