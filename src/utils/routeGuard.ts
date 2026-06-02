/**
 * Route-guard decision logic.
 *
 * Exposes a pure predicate that decides whether a user should be redirected to
 * the login interface based on the current session state. Keeping this logic
 * pure (it receives the session state and the reference time as arguments)
 * makes it trivially testable and free of side effects, so the same decision
 * can be reused by the router guard, the main layout, and the HTTP 401 handler.
 *
 * The guard returns `true` (redirect to login) when:
 *   - no session exists (e.g. the post-401 cleared state, or before login), or
 *   - the session carries no usable token (missing/empty/whitespace), or
 *   - the session token has expired (`expiresAt` at or before the reference
 *     time).
 *
 * (Requirements 1.6, 11.4, 11.5)
 */
import type { SessionData } from '../types';

/**
 * Decide whether the current session requires a redirect to the login screen.
 *
 * @param session The current session state, or `null` when no session is
 *   stored (missing token, or cleared after a 401 / logout).
 * @param now Reference time in Unix milliseconds used to evaluate expiry.
 *   Defaults to `Date.now()`. Supplying it explicitly keeps the function
 *   deterministic for testing.
 * @returns `true` when the user should be redirected to login; otherwise
 *   `false`.
 */
export function shouldRedirectToLogin(
  session: SessionData | null,
  now: number = Date.now(),
): boolean {
  // No session at all: covers the initial unauthenticated state and the
  // post-401 / post-logout cleared state (Requirements 1.6, 11.4, 11.5).
  if (session === null) {
    return true;
  }

  // A session without a usable token is equivalent to having no token.
  if (typeof session.token !== 'string' || session.token.trim() === '') {
    return true;
  }

  // An expired token requires re-authentication. A token whose expiry is at or
  // before the reference time is treated as expired (Requirements 11.4, 11.5).
  if (session.expiresAt <= now) {
    return true;
  }

  return false;
}
