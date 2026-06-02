import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { authService as defaultAuthService } from '../services/authService';
import { webSocketService as defaultWebSocketService } from '../services/webSocketService';
import { clearToken as defaultClearToken } from '../infrastructure/sessionStore';
import type { AuthService, WebSocketService } from '../types';

/**
 * Public API exposed by the {@link AuthContext}.
 *
 * Matches the `AuthContextValue` interface from the design document:
 *  - `isAuthenticated` / `token` reflect the current session.
 *  - `login` authenticates and resolves to `true` on success.
 *  - `logout` terminates the session (closing any active WebSocket first).
 *  - `lastActivity` / `updateActivity` drive the inactivity timeout.
 */
export interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  lastActivity: Date;
  updateActivity: () => void;
  /**
   * The API-provided failure reason from the most recent failed login, or
   * `null` when the last attempt succeeded / no attempt has been made. Lets the
   * login interface display the authentication failure reason returned by the
   * API (Requirement 1.4) while keeping `login`'s boolean contract intact.
   */
  loginError: string | null;
}

/**
 * Inactivity window after which the user is automatically logged out
 * (Requirement 11.6): 30 minutes.
 */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/** Path of the login interface used for the post-logout redirect. */
const LOGIN_PATH = '/login';

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Default navigation side-effect: redirect the browser to the login interface
 * (Requirement 11.2). A direct `window.location` assignment is used so the
 * redirect happens immediately (well within the 1-second budget) regardless of
 * the router state.
 */
function defaultRedirectToLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.assign(LOGIN_PATH);
  }
}

/**
 * Default fallback when clearing the token fails (Requirement 11.7): force a
 * full page reload so the session is guaranteed to be terminated.
 */
function defaultForceReload(): void {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Props for {@link AuthProvider}.
 *
 * The service/side-effect dependencies are injectable to keep the provider
 * testable; in the running application they default to the real singletons and
 * browser navigation.
 */
export interface AuthProviderProps {
  children: ReactNode;
  /** Authentication service (defaults to the shared `authService`). */
  authService?: AuthService;
  /**
   * WebSocket service whose active connection is closed on logout
   * (Requirement 11.3). Only `disconnect` is required.
   */
  webSocketService?: Pick<WebSocketService, 'disconnect'>;
  /**
   * Clears the persisted session, returning `true` on success and `false` when
   * `sessionStorage` could not be cleared (Requirement 11.7). Defaults to the
   * session-store `clearToken`.
   */
  clearSession?: () => boolean;
  /** Redirects to the login interface (Requirement 11.2). */
  redirectToLogin?: () => void;
  /** Forces a full page reload when token clearing fails (Requirement 11.7). */
  forceReload?: () => void;
  /** Inactivity timeout in milliseconds (defaults to {@link INACTIVITY_TIMEOUT_MS}). */
  inactivityTimeoutMs?: number;
}

/**
 * Provides authentication state and session management to the application.
 *
 * Wires the {@link AuthService} (login / current-session queries) and the
 * session store (token clearing) together, and closes any active WebSocket
 * connection on logout (Requirement 11.3). A rolling inactivity timer logs the
 * user out after {@link INACTIVITY_TIMEOUT_MS} of no recorded activity
 * (Requirement 11.6).
 */
export function AuthProvider({
  children,
  authService = defaultAuthService,
  webSocketService = defaultWebSocketService,
  clearSession = defaultClearToken,
  redirectToLogin = defaultRedirectToLogin,
  forceReload = defaultForceReload,
  inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS,
}: AuthProviderProps) {
  // Initialize from the current session, honoring token expiry so a stale
  // (expired) token does not present as authenticated on load.
  const [token, setToken] = useState<string | null>(() =>
    authService.isAuthenticated() ? authService.getToken() : null,
  );
  const [lastActivity, setLastActivity] = useState<Date>(() => new Date());
  const [loginError, setLoginError] = useState<string | null>(null);

  const isAuthenticated = token !== null;

  // Hold the latest logout in a ref so the inactivity timer always calls the
  // current implementation without re-subscribing on every render.
  const logoutRef = useRef<() => void>(() => {});

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const result = await authService.login(username, password);
      if (result.success && typeof result.token === 'string') {
        setToken(result.token);
        setLastActivity(new Date());
        setLoginError(null);
        return true;
      }
      // Surface the API-provided failure reason so the login interface can
      // display it (Requirement 1.4).
      setLoginError(result.error ?? null);
      return false;
    },
    [authService],
  );

  const logout = useCallback((): void => {
    // 1. Close any active WebSocket connection BEFORE clearing the token and
    //    redirecting (Requirement 11.3).
    try {
      webSocketService.disconnect();
    } catch {
      // A failure to close the socket must not block session termination.
    }

    // 2. Clear the persisted token (Requirement 11.2).
    const cleared = clearSession();
    setToken(null);

    // 3. If the token could not be cleared, force a page reload so the session
    //    is still terminated (Requirement 11.7).
    if (!cleared) {
      forceReload();
      return;
    }

    // 4. Redirect to the login interface (Requirement 11.2).
    redirectToLogin();
  }, [webSocketService, clearSession, forceReload, redirectToLogin]);

  logoutRef.current = logout;

  const updateActivity = useCallback((): void => {
    setLastActivity(new Date());
  }, []);

  // Rolling inactivity timeout (Requirement 11.6). The timer is (re)armed
  // whenever activity is recorded; firing it auto-logs-out the user. No timer
  // runs while unauthenticated.
  useEffect(() => {
    if (token === null) {
      return undefined;
    }

    const elapsed = Date.now() - lastActivity.getTime();
    const remaining = Math.max(0, inactivityTimeoutMs - elapsed);

    const timer = setTimeout(() => {
      logoutRef.current();
    }, remaining);

    return () => clearTimeout(timer);
  }, [token, lastActivity, inactivityTimeoutMs]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      token,
      login,
      logout,
      lastActivity,
      updateActivity,
      loginError,
    }),
    [
      isAuthenticated,
      token,
      login,
      logout,
      lastActivity,
      updateActivity,
      loginError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for consuming the auth context. Throws if used outside an
 * {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
