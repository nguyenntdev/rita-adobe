import fc from 'fast-check';
import { shouldRedirectToLogin } from './routeGuard';
import type { SessionData } from '../types';

/**
 * Feature: rita-adobe, Property 7: Authentication redirect invariant
 *
 * For any session state, the route-guard decision shouldRedirectToLogin returns
 * "redirect" (true) if and only if there is NO valid unexpired token — that is,
 * when the session is missing/cleared (null, e.g. the post-401 cleared state),
 * the token is missing/empty/whitespace-only, or the token has expired
 * (expiresAt at or before the reference time). Equivalently, the guard returns
 * false (allow access) iff a non-empty token exists and has not expired.
 *
 * Validates: Requirements 1.6, 11.4, 11.5
 *
 * Strategy: rather than re-deriving the guard's branch logic, sessions are
 * produced by structured generators whose category is known by construction —
 * valid unexpired tokens, expired tokens, missing/blank tokens, and the
 * post-401 cleared (null) state. An independent oracle (a non-null session with
 * a non-blank token whose expiry is strictly after `now`) computes the expected
 * "do not redirect" outcome, so the property checks the iff directly.
 */

// Whitespace characters considered "blank" by the guard's token.trim() check.
const WHITESPACE = [' ', '\t', '\n', '\r', '\f', '\v'];

// A reference time used to evaluate expiry. Generated alongside sessions.
const nowArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

// Non-blank token: at least one non-whitespace character.
const nonBlankToken = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim() !== '');

// Blank token: empty or whitespace-only.
const blankToken = fc
  .stringOf(fc.constantFrom(...WHITESPACE), { minLength: 0, maxLength: 8 });

interface Case {
  session: SessionData | null;
  now: number;
  // Known expected guard decision (true = redirect to login).
  expectedRedirect: boolean;
}

// --- Valid unexpired token: expiresAt strictly after `now` ------------------
const validUnexpired: fc.Arbitrary<Case> = fc
  .record({
    token: nonBlankToken,
    now: nowArb,
    delta: fc.integer({ min: 1, max: 1_000_000_000 }),
    lastActivity: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  })
  .map(({ token, now, delta, lastActivity }) => ({
    session: { token, expiresAt: now + delta, lastActivity },
    now,
    expectedRedirect: false,
  }));

// --- Expired token: non-blank token but expiresAt <= now --------------------
const expiredToken: fc.Arbitrary<Case> = fc
  .record({
    token: nonBlankToken,
    now: nowArb,
    // delta >= 0 makes expiresAt <= now (0 = expires exactly at `now`).
    delta: fc.integer({ min: 0, max: 1_000_000_000 }),
    lastActivity: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  })
  .map(({ token, now, delta, lastActivity }) => ({
    session: { token, expiresAt: now - delta, lastActivity },
    now,
    expectedRedirect: true,
  }));

// --- Missing/blank token (regardless of expiry) -----------------------------
const blankTokenSession: fc.Arbitrary<Case> = fc
  .record({
    token: blankToken,
    now: nowArb,
    // Use a future expiry to prove the blank-token branch dominates.
    delta: fc.integer({ min: 1, max: 1_000_000_000 }),
    lastActivity: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  })
  .map(({ token, now, delta, lastActivity }) => ({
    session: { token, expiresAt: now + delta, lastActivity },
    now,
    expectedRedirect: true,
  }));

// --- Post-401 cleared / missing session (null) ------------------------------
const clearedSession: fc.Arbitrary<Case> = nowArb.map((now) => ({
  session: null,
  now,
  expectedRedirect: true,
}));

const anyCase: fc.Arbitrary<Case> = fc.oneof(
  validUnexpired,
  expiredToken,
  blankTokenSession,
  clearedSession,
);

describe('shouldRedirectToLogin — Property 7: Authentication redirect invariant', () => {
  it('redirects iff there is no valid unexpired token', () => {
    fc.assert(
      fc.property(anyCase, ({ session, now, expectedRedirect }) => {
        const result = shouldRedirectToLogin(session, now);

        // Decision matches the category known by construction.
        expect(result).toBe(expectedRedirect);

        // Independent oracle: a valid unexpired token exists iff the session is
        // non-null, its token is non-blank, and it expires strictly after now.
        const hasValidToken =
          session !== null &&
          typeof session.token === 'string' &&
          session.token.trim() !== '' &&
          session.expiresAt > now;

        // The iff: redirect exactly when no valid unexpired token exists.
        expect(result).toBe(!hasValidToken);
      }),
      { numRuns: 100 },
    );
  });
});
