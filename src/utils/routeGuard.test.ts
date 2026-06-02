import { shouldRedirectToLogin } from './routeGuard';
import type { SessionData } from '../types';

describe('shouldRedirectToLogin', () => {
  const now = 1_000_000;

  const validSession = (overrides: Partial<SessionData> = {}): SessionData => ({
    token: 'valid-token',
    expiresAt: now + 60_000,
    lastActivity: now,
    ...overrides,
  });

  it('redirects when no session exists (post-401 / post-logout cleared state)', () => {
    expect(shouldRedirectToLogin(null, now)).toBe(true);
  });

  it('does not redirect for a valid, unexpired token', () => {
    expect(shouldRedirectToLogin(validSession(), now)).toBe(false);
  });

  it('redirects when the token has expired', () => {
    expect(
      shouldRedirectToLogin(validSession({ expiresAt: now - 1 }), now),
    ).toBe(true);
  });

  it('treats a token expiring exactly at the reference time as expired', () => {
    expect(
      shouldRedirectToLogin(validSession({ expiresAt: now }), now),
    ).toBe(true);
  });

  it('redirects when the session token is an empty string', () => {
    expect(shouldRedirectToLogin(validSession({ token: '' }), now)).toBe(true);
  });

  it('redirects when the session token is whitespace only', () => {
    expect(shouldRedirectToLogin(validSession({ token: '   ' }), now)).toBe(
      true,
    );
  });

  it('defaults the reference time to Date.now() when omitted', () => {
    const future = validSession({ expiresAt: Date.now() + 60_000 });
    const past = validSession({ expiresAt: Date.now() - 60_000 });
    expect(shouldRedirectToLogin(future)).toBe(false);
    expect(shouldRedirectToLogin(past)).toBe(true);
  });
});
