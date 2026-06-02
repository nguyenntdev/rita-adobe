import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  LoginPage,
  LOGIN_TITLE,
  USERNAME_REQUIRED_ERROR,
  PASSWORD_REQUIRED_ERROR,
} from './LoginPage';
import { AuthProvider } from '../../context/AuthContext';
import type { AuthService } from '../../types';

/**
 * Component tests for LoginPage (task 14.2).
 *
 * LoginPage is rendered inside the real {@link AuthProvider} with an injected
 * mock {@link AuthService}, so the tests exercise the actual `login` /
 * `loginError` wiring without real network calls.
 *
 * Requirements:
 *  - 1.1 username + password fields render
 *  - 1.4 the API failure reason is displayed on authentication failure
 *  - 1.7 empty credentials trigger a validation error and block the request
 */

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

function renderLogin(authService: AuthService) {
  return render(
    <AuthProvider
      authService={authService}
      webSocketService={{ disconnect: jest.fn() }}
      clearSession={jest.fn(() => true)}
      redirectToLogin={jest.fn()}
      forceReload={jest.fn()}
    >
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage - rendering (Req 1.1)', () => {
  it('renders the title and the username and password fields', () => {
    renderLogin(makeAuthService());

    expect(
      screen.getByRole('heading', { name: LOGIN_TITLE }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Log in' }),
    ).toBeInTheDocument();
  });

  it('renders the password field as a masked input', () => {
    renderLogin(makeAuthService());

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
  });
});

describe('LoginPage - empty-field validation (Req 1.7)', () => {
  it('shows both required errors and blocks the request when both fields are empty', async () => {
    const user = userEvent.setup();
    const authService = makeAuthService();
    renderLogin(authService);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText(USERNAME_REQUIRED_ERROR)).toBeInTheDocument();
    expect(screen.getByText(PASSWORD_REQUIRED_ERROR)).toBeInTheDocument();
    // The authentication request must never be issued for empty credentials.
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('blocks the request when only the password is empty', async () => {
    const user = userEvent.setup();
    const authService = makeAuthService();
    renderLogin(authService);

    await user.type(screen.getByLabelText('Username'), 'agent');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText(PASSWORD_REQUIRED_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(USERNAME_REQUIRED_ERROR)).not.toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('blocks the request when the fields contain only whitespace', async () => {
    const user = userEvent.setup();
    const authService = makeAuthService();
    renderLogin(authService);

    await user.type(screen.getByLabelText('Username'), '   ');
    await user.type(screen.getByLabelText('Password'), '   ');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText(USERNAME_REQUIRED_ERROR)).toBeInTheDocument();
    expect(screen.getByText(PASSWORD_REQUIRED_ERROR)).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe('LoginPage - authentication outcomes (Req 1.4)', () => {
  it('issues the authentication request with the entered credentials', async () => {
    const user = userEvent.setup();
    const authService = makeAuthService();
    renderLogin(authService);

    await user.type(screen.getByLabelText('Username'), 'agent');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('agent', 'secret-pass');
    });
  });

  it('displays the API failure reason when authentication fails', async () => {
    const user = userEvent.setup();
    const authService = makeAuthService({
      login: jest.fn(async () => ({
        success: false,
        error: 'Invalid username or password',
      })),
    });
    renderLogin(authService);

    await user.type(screen.getByLabelText('Username'), 'agent');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid username or password'),
      ).toBeInTheDocument();
    });
    expect(authService.login).toHaveBeenCalledWith('agent', 'wrong-pass');
  });
});
