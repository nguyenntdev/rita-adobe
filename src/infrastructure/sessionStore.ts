/**
 * Session storage adapter.
 *
 * Persists the authentication token, its expiry, and the last-activity
 * timestamp in `sessionStorage`. Centralizing access here keeps the storage
 * key and (de)serialization in one place so services, the HTTP client, and the
 * auth context all read/write a consistent shape.
 *
 * (Requirements 1.3, 11.4, 11.5, 11.7)
 */
import type { SessionData } from '../types';

/** Storage key under which the session payload is persisted. */
const SESSION_KEY = 'rita-adobe.session';

/**
 * Persist a token and its expiry, resetting the last-activity timestamp to now.
 *
 * @returns `true` when the write succeeds; `false` when `sessionStorage` throws
 *   (e.g. storage disabled or quota exceeded), so callers can decide whether to
 *   force a reload (Requirement 11.7).
 */
export function storeToken(token: string, expiresAt: number): boolean {
  const data: SessionData = {
    token,
    expiresAt,
    lastActivity: Date.now(),
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve the full session payload, or `null` when absent or unreadable.
 */
export function getSessionData(): SessionData | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionData>;
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.lastActivity !== 'number'
    ) {
      return null;
    }
    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      lastActivity: parsed.lastActivity,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieve the stored auth token, or `null` when no session exists.
 */
export function getToken(): string | null {
  return getSessionData()?.token ?? null;
}

/**
 * Remove the stored session.
 *
 * @returns `true` when the clear succeeds; `false` when `sessionStorage` throws,
 *   so callers can force a page reload to guarantee the session is terminated
 *   (Requirement 11.7).
 */
export function clearToken(): boolean {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the stored token is expired (or missing).
 *
 * A missing session is treated as expired so route guards redirect to login
 * (Requirements 11.4, 11.5).
 */
export function isTokenExpired(now: number = Date.now()): boolean {
  const data = getSessionData();
  if (data === null) {
    return true;
  }
  return now >= data.expiresAt;
}
