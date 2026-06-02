import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from './components/EmailInput/EmailInput';
import type { SessionData } from './types';

/**
 * End-to-end integration tests for the wired application (task 18.2).
 *
 * The service singletons and session store are mocked with coordinated mutable
 * state so the real App composition (AuthProvider → NotificationProvider →
 * Router → MainLayout route guard → pages) can be exercised without network or
 * WebSocket access. Covered:
 *   - unauthenticated access to a protected route redirects to login (Req 1.6,
 *     11.4, 11.5)
 *   - a successful login grants access to the protected dashboard (Req 1.6)
 *   - a 401 that clears the session redirects subsequent protected access to
 *     login (Req 1.6, 11.4)
 *   - dashboard operations route their success/error results into the
 *     corresponding panels (Req 12.3, 12.4)
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

// --- Coordinated mock session state shared by the auth service + store. ---
let mockSession: SessionData | null = null;

function setAuthenticated(token = 'live-token') {
  mockSession = {
    token,
    expiresAt: Date.now() + ONE_HOUR_MS,
    lastActivity: Date.now(),
  };
}

jest.mock('./services/authService', () => ({
  authService: {
    login: jest.fn(async (_u: string, _p: string) => {
      mockSession = {
        token: 'live-token',
        expiresAt: Date.now() + 60 * 60 * 1000,
        lastActivity: Date.now(),
      };
      return { success: true, token: 'live-token' };
    }),
    logout: jest.fn(() => {
      mockSession = null;
    }),
    getToken: jest.fn(() => mockSession?.token ?? null),
    isAuthenticated: jest.fn(() => mockSession !== null),
    isTokenExpired: jest.fn(() => mockSession === null),
  },
}));

jest.mock('./infrastructure/sessionStore', () => ({
  getSessionData: jest.fn((): SessionData | null => mockSession),
  clearToken: jest.fn(() => {
    mockSession = null;
    return true;
  }),
  getToken: jest.fn(() => mockSession?.token ?? null),
  storeToken: jest.fn(() => true),
  isTokenExpired: jest.fn(() => mockSession === null),
}));

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

import { authService } from './services/authService';
import { accountService } from './services/accountService';

const mockedLogin = authService.login as jest.Mock;
const mockedCheckAccount = accountService.checkAccount as jest.Mock;

function gotoPath(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  mockSession = null;
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  gotoPath('/');
});

describe('App routing - authentication guard (Req 1.6, 11.4, 11.5)', () => {
  it('redirects unauthenticated access to a protected route to the login page', () => {
    gotoPath('/');
    render(<App />);

    // The dashboard is protected; with no session the guard redirects to login.
    expect(
      screen.getByRole('heading', { name: 'RITA Adobe' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('grants access to the protected dashboard after a successful login (Req 1.6)', async () => {
    const user = userEvent.setup();
    gotoPath('/login');
    render(<App />);

    await user.type(screen.getByLabelText('Username'), 'agent');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(mockedLogin).toHaveBeenCalledWith('agent', 'secret');

    // After login the LoginPage redirects to the dashboard, which now renders
    // because the guard sees a valid session.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Account Dashboard' }),
      ).toBeInTheDocument(),
    );
  });

  it('redirects to login when the session has been cleared by a 401 (Req 1.6, 11.4)', () => {
    // Simulate a post-401 cleared session: no token in the store.
    mockSession = null;
    gotoPath('/account/check');
    render(<App />);

    // Protected route is not accessible; the login interface is shown instead.
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Account Status Check' }),
    ).not.toBeInTheDocument();
  });
});

describe('App dashboard operations (Req 12.3, 12.4)', () => {
  it('routes a successful account status result into the Account Status panel', async () => {
    setAuthenticated();
    mockedCheckAccount.mockResolvedValue({
      success: true,
      data: { status: 'active', plan: 'pro' },
    });

    gotoPath('/');
    render(<App />);

    // The dashboard renders for the authenticated session.
    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    // Wait for the EmailInput debounce to enable the action button (real timers).
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
    setAuthenticated();
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
