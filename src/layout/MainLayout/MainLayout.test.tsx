import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MainLayout, DESKTOP_ONLY_MESSAGE } from './MainLayout';
import { AuthProvider } from '../../context/AuthContext';
import { APP_NAME } from '../Header';
import type { AuthService, SessionData } from '../../types';

/**
 * Component tests for the MainLayout (Task 12.3).
 *
 * Covers Requirements:
 * - 11.4 / 11.5 / 1.6: route guard redirects to login when no usable, unexpired
 *   session token exists; renders the shell when authenticated.
 * - 9.5 / 9.6: viewport guard renders the desktop-only message below 1024px and
 *   renders the full shell at >= 1024px.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

function makeAuthService(authenticated: boolean): AuthService {
  return {
    login: jest.fn(async () => ({ success: true, token: 'tok' })),
    logout: jest.fn(),
    getToken: jest.fn(() => (authenticated ? 'live-token' : null)),
    isAuthenticated: jest.fn(() => authenticated),
    isTokenExpired: jest.fn(() => !authenticated),
  };
}

/** Set the jsdom viewport width and notify listeners. */
function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

interface RenderOptions {
  authenticated?: boolean;
  session?: SessionData | null;
  now?: number;
  width?: number;
}

function renderLayout({
  authenticated = true,
  session = { token: 'live-token', expiresAt: Date.now() + ONE_HOUR_MS, lastActivity: Date.now() },
  now,
  width = 1280,
}: RenderOptions = {}) {
  setViewportWidth(width);

  return render(
    <AuthProvider
      authService={makeAuthService(authenticated)}
      webSocketService={{ disconnect: jest.fn() }}
      clearSession={jest.fn(() => true)}
      redirectToLogin={jest.fn()}
      forceReload={jest.fn()}
    >
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<MainLayout getSession={() => session} now={now} />}
          >
            <Route index element={<div>Dashboard content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  setViewportWidth(1024);
});

describe('MainLayout', () => {
  it('renders Header, Sidebar, and content when authenticated on desktop (Req 9.5, 11.5)', () => {
    renderLayout();

    // Header brand and Sidebar navigation are composed into the shell.
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    // Nested route content renders through the Outlet.
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    // No redirect occurred.
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to login when the context is unauthenticated (Req 1.6, 11.4)', () => {
    renderLayout({ authenticated: false, session: null });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects to login when the stored token is expired (Req 11.4, 11.5)', () => {
    const now = 1_000_000;
    renderLayout({
      authenticated: true,
      session: { token: 'stale', expiresAt: now - 1, lastActivity: now },
      now,
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('renders the desktop-only message below 1024px (Req 9.6)', () => {
    renderLayout({ width: 800 });

    expect(screen.getByRole('alert')).toHaveTextContent(DESKTOP_ONLY_MESSAGE);
    // The shell (and its content) is suppressed below the desktop minimum.
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
    expect(screen.queryByText(APP_NAME)).not.toBeInTheDocument();
  });

  it('renders the shell at exactly 1024px (Req 9.5)', () => {
    renderLayout({ width: 1024 });

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('switches to the desktop-only message when the viewport shrinks (Req 9.6)', () => {
    renderLayout({ width: 1280 });

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();

    act(() => {
      setViewportWidth(700);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(DESKTOP_ONLY_MESSAGE);
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });
});
