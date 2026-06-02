import { act, cleanup, render, screen } from '@testing-library/react';
import {
  AuthProvider,
  INACTIVITY_TIMEOUT_MS,
  useAuth,
  type AuthContextValue,
} from './AuthContext';
import type { AuthService } from '../types';

/**
 * Unit tests for the AuthContext (Task 9.3).
 *
 * Cover the wiring and ordering guarantees the context is responsible for:
 *  - `login` resolves true/false and exposes the token (Requirement 11.x).
 *  - `logout` closes any active WebSocket BEFORE clearing the token and
 *    redirecting (Requirements 11.2, 11.3).
 *  - A failed token clear forces a page reload (Requirement 11.7).
 *  - 30 minutes of inactivity auto-logs-out (Requirement 11.6).
 */

// Captures the live context value so tests can drive login/logout/activity.
let api: AuthContextValue | null = null;

function CaptureApi() {
  api = useAuth();
  return (
    <div>
      <span data-testid="authed">{String(api.isAuthenticated)}</span>
      <span data-testid="token">{api.token ?? ''}</span>
    </div>
  );
}

function makeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: jest.fn(async () => ({ success: true, token: 'tok' })),
    logout: jest.fn(),
    getToken: jest.fn(() => null),
    isAuthenticated: jest.fn(() => false),
    isTokenExpired: jest.fn(() => true),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  api = null;
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('AuthContext - login', () => {
  it('stores the token and reports authenticated on success', async () => {
    const authService = makeAuthService({
      login: jest.fn(async () => ({ success: true, token: 'fresh-token' })),
    });

    render(
      <AuthProvider authService={authService}>
        <CaptureApi />
      </AuthProvider>,
    );

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await (api as AuthContextValue).login('user', 'pass');
    });

    expect(outcome).toBe(true);
    expect(authService.login).toHaveBeenCalledWith('user', 'pass');
    expect(screen.getByTestId('authed').textContent).toBe('true');
    expect(screen.getByTestId('token').textContent).toBe('fresh-token');
  });

  it('returns false and stays unauthenticated on failure', async () => {
    const authService = makeAuthService({
      login: jest.fn(async () => ({ success: false, error: 'bad creds' })),
    });

    render(
      <AuthProvider authService={authService}>
        <CaptureApi />
      </AuthProvider>,
    );

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await (api as AuthContextValue).login('user', 'wrong');
    });

    expect(outcome).toBe(false);
    expect(screen.getByTestId('authed').textContent).toBe('false');
    expect(screen.getByTestId('token').textContent).toBe('');
  });

  it('initializes the token from an already-authenticated session', () => {
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'existing-token'),
    });

    render(
      <AuthProvider authService={authService}>
        <CaptureApi />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authed').textContent).toBe('true');
    expect(screen.getByTestId('token').textContent).toBe('existing-token');
  });
});

describe('AuthContext - logout', () => {
  it('closes the WebSocket before clearing the token, then redirects', async () => {
    const calls: string[] = [];
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'live-token'),
    });
    const webSocketService = {
      disconnect: jest.fn(() => {
        calls.push('disconnect');
      }),
    };
    const clearSession = jest.fn(() => {
      calls.push('clear');
      return true;
    });
    const redirectToLogin = jest.fn(() => {
      calls.push('redirect');
    });
    const forceReload = jest.fn();

    render(
      <AuthProvider
        authService={authService}
        webSocketService={webSocketService}
        clearSession={clearSession}
        redirectToLogin={redirectToLogin}
        forceReload={forceReload}
      >
        <CaptureApi />
      </AuthProvider>,
    );

    act(() => {
      (api as AuthContextValue).logout();
    });

    // Ordering guarantee: socket closed before the token is cleared, and the
    // redirect happens after clearing (Requirements 11.2, 11.3).
    expect(calls).toEqual(['disconnect', 'clear', 'redirect']);
    expect(forceReload).not.toHaveBeenCalled();
    expect(screen.getByTestId('authed').textContent).toBe('false');
    expect(screen.getByTestId('token').textContent).toBe('');
  });

  it('forces a page reload when clearing the token fails', () => {
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'live-token'),
    });
    const webSocketService = { disconnect: jest.fn() };
    const clearSession = jest.fn(() => false);
    const redirectToLogin = jest.fn();
    const forceReload = jest.fn();

    render(
      <AuthProvider
        authService={authService}
        webSocketService={webSocketService}
        clearSession={clearSession}
        redirectToLogin={redirectToLogin}
        forceReload={forceReload}
      >
        <CaptureApi />
      </AuthProvider>,
    );

    act(() => {
      (api as AuthContextValue).logout();
    });

    expect(webSocketService.disconnect).toHaveBeenCalledTimes(1);
    expect(forceReload).toHaveBeenCalledTimes(1);
    // When reload is forced, the normal redirect is skipped (Requirement 11.7).
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});

describe('AuthContext - logout timing (Requirement 11.2)', () => {
  it('clears the token and redirects within 1 second of logout', () => {
    jest.useFakeTimers();
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'live-token'),
    });
    const clearTimes: number[] = [];
    const redirectTimes: number[] = [];
    const clearSession = jest.fn(() => {
      clearTimes.push(Date.now());
      return true;
    });
    const redirectToLogin = jest.fn(() => {
      redirectTimes.push(Date.now());
    });

    render(
      <AuthProvider
        authService={authService}
        webSocketService={{ disconnect: jest.fn() }}
        clearSession={clearSession}
        redirectToLogin={redirectToLogin}
        forceReload={jest.fn()}
      >
        <CaptureApi />
      </AuthProvider>,
    );

    const start = Date.now();
    act(() => {
      (api as AuthContextValue).logout();
    });

    // Both the token clear and the redirect must have happened already (no
    // timer advance needed) — comfortably within the 1-second budget.
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
    expect(clearTimes[0] - start).toBeLessThanOrEqual(1000);
    expect(redirectTimes[0] - start).toBeLessThanOrEqual(1000);

    // The redirect is not deferred by any pending timer beyond the 1s budget:
    // advancing fake time by 1s triggers no additional redirect calls.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});

describe('AuthContext - inactivity timeout (Requirement 11.6)', () => {
  it('auto-logs-out after 30 minutes without activity', () => {
    jest.useFakeTimers();
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'live-token'),
    });
    const webSocketService = { disconnect: jest.fn() };
    const clearSession = jest.fn(() => true);
    const redirectToLogin = jest.fn();
    const forceReload = jest.fn();

    render(
      <AuthProvider
        authService={authService}
        webSocketService={webSocketService}
        clearSession={clearSession}
        redirectToLogin={redirectToLogin}
        forceReload={forceReload}
      >
        <CaptureApi />
      </AuthProvider>,
    );

    expect(redirectToLogin).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    });

    // The inactivity timer ran logout, which clears + redirects.
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('resets the inactivity window when activity is recorded', () => {
    jest.useFakeTimers();
    const authService = makeAuthService({
      isAuthenticated: jest.fn(() => true),
      getToken: jest.fn(() => 'live-token'),
    });
    const redirectToLogin = jest.fn();

    render(
      <AuthProvider
        authService={authService}
        webSocketService={{ disconnect: jest.fn() }}
        clearSession={jest.fn(() => true)}
        redirectToLogin={redirectToLogin}
        forceReload={jest.fn()}
      >
        <CaptureApi />
      </AuthProvider>,
    );

    // Advance most of the window, then record activity to reset it.
    act(() => {
      jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
    });
    act(() => {
      (api as AuthContextValue).updateActivity();
    });

    // Advancing past the original deadline must NOT trigger logout.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(redirectToLogin).not.toHaveBeenCalled();

    // Only after a fresh full window elapses does logout fire.
    act(() => {
      jest.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    });
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
