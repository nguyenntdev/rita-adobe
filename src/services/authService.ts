/**
 * Authentication service.
 *
 * Implements the {@link AuthService} contract on top of the shared HTTP client
 * and session-storage adapter:
 *  - `login` requests a token from `/ades-support/auth/token`; on success it
 *    persists the token and its expiry (Requirements 1.2, 1.3) and, on failure,
 *    surfaces the API-provided failure reason (Requirement 1.4).
 *  - `logout` clears the stored session (Requirement 11.2).
 *  - `getToken`, `isAuthenticated`, and `isTokenExpired` read the current
 *    session state through the session store.
 *
 * The service intentionally holds no in-memory token state; the session store
 * is the single source of truth so the HTTP client, route guard, and auth
 * context all observe a consistent session.
 */
import { HttpError, httpClient } from '../infrastructure/httpClient';
import {
  clearToken,
  getToken,
  isTokenExpired,
  storeToken,
} from '../infrastructure/sessionStore';
import type { AuthResult, AuthService } from '../types';

/** Path of the ADES Support token endpoint (Requirement 1.2). */
const TOKEN_ENDPOINT = '/ades-support/auth/token';

/**
 * Fallback token lifetime applied when the API response omits any expiry
 * information, so a session always carries a usable `expiresAt` for the route
 * guard and session store to evaluate.
 */
const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Generic message used when a login fails without an API-provided reason. */
const DEFAULT_LOGIN_ERROR = 'Authentication failed. Please try again.';

/**
 * Resolve the auth token from the various shapes the token endpoint may return
 * (`token` or `access_token`).
 */
function extractToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  for (const key of ['token', 'access_token'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
}

/**
 * Resolve the token expiry (as a Unix millisecond timestamp) from the response.
 *
 * Supports an absolute `expiresAt` timestamp or a relative `expiresIn` /
 * `expires_in` lifetime in seconds, falling back to {@link DEFAULT_TOKEN_TTL_MS}
 * when neither is provided.
 */
function extractExpiresAt(data: unknown, now: number): number {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;

    const expiresAt = record.expiresAt;
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
      return expiresAt;
    }

    for (const key of ['expiresIn', 'expires_in'] as const) {
      const seconds = record[key];
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        return now + seconds * 1000;
      }
    }
  }
  return now + DEFAULT_TOKEN_TTL_MS;
}

/**
 * Request an authentication token and persist the session on success.
 *
 * @returns An {@link AuthResult}: `{ success: true, token }` when a token is
 *   issued and stored, or `{ success: false, error }` carrying the API failure
 *   reason otherwise (Requirement 1.4).
 */
async function login(username: string, password: string): Promise<AuthResult> {
  try {
    const response = await httpClient.post(TOKEN_ENDPOINT, {
      username,
      password,
    });

    const token = extractToken(response.data);
    if (token === null) {
      return { success: false, error: DEFAULT_LOGIN_ERROR };
    }

    const expiresAt = extractExpiresAt(response.data, Date.now());
    storeToken(token, expiresAt);

    return { success: true, token };
  } catch (error) {
    if (error instanceof HttpError) {
      return { success: false, error: error.apiMessage ?? error.userMessage };
    }
    return { success: false, error: DEFAULT_LOGIN_ERROR };
  }
}

/**
 * Clear the stored session, terminating the authenticated session
 * (Requirement 11.2).
 */
function logout(): void {
  clearToken();
}

/**
 * Whether a usable, unexpired token is currently stored.
 */
function isAuthenticated(): boolean {
  return getToken() !== null && !isTokenExpired();
}

/**
 * The authentication service singleton conforming to {@link AuthService}.
 */
export const authService: AuthService = {
  login,
  logout,
  getToken,
  isAuthenticated,
  isTokenExpired,
};
