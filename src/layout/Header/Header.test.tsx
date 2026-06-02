import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header, APP_NAME } from './Header';
import { AuthProvider } from '../../context/AuthContext';
import type { AuthService } from '../../types';

/**
 * Component tests for the Header (Task 12.1).
 *
 * Covers Requirements:
 * - 9.4: the application name "RITA Adobe" is displayed in the header.
 * - 11.1: a logout button is present and wired to AuthContext's `logout`,
 *   which closes the WebSocket, clears the session, and redirects to login.
 */

function makeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: jest.fn(async () => ({ success: true, token: 'tok' })),
    logout: jest.fn(),
    // Start authenticated so the header represents a logged-in session.
    getToken: jest.fn(() => 'live-token'),
    isAuthenticated: jest.fn(() => true),
    isTokenExpired: jest.fn(() => false),
    ...overrides,
  };
}

function renderHeader(
  deps: {
    webSocketService?: { disconnect: jest.Mock };
    clearSession?: jest.Mock;
    redirectToLogin?: jest.Mock;
    forceReload?: jest.Mock;
  } = {},
) {
  const webSocketService = deps.webSocketService ?? { disconnect: jest.fn() };
  const clearSession = deps.clearSession ?? jest.fn(() => true);
  const redirectToLogin = deps.redirectToLogin ?? jest.fn();
  const forceReload = deps.forceReload ?? jest.fn();

  render(
    <AuthProvider
      authService={makeAuthService()}
      webSocketService={webSocketService}
      clearSession={clearSession}
      redirectToLogin={redirectToLogin}
      forceReload={forceReload}
    >
      <Header />
    </AuthProvider>,
  );

  return { webSocketService, clearSession, redirectToLogin, forceReload };
}

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('displays the application name "RITA Adobe" (Req 9.4)', () => {
    renderHeader();

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText('RITA Adobe')).toBeInTheDocument();
  });

  it('renders a logout button in the header (Req 11.1)', () => {
    renderHeader();

    expect(
      screen.getByRole('button', { name: 'Logout' }),
    ).toBeInTheDocument();
  });

  it('clicking logout clears the session and redirects (Req 11.1)', async () => {
    const user = userEvent.setup();
    const { webSocketService, clearSession, redirectToLogin } = renderHeader();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Logout' }));
    });

    // logout closes the WebSocket, clears the token, then redirects.
    expect(webSocketService.disconnect).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
