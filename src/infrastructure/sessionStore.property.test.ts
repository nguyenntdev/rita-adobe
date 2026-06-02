import fc from 'fast-check';
import { storeToken, getToken, clearToken } from './sessionStore';

/**
 * Feature: rita-adobe, Property 2: Session token storage round-trip
 *
 * For any authentication token string, storing the token via the session
 * storage adapter and then retrieving it returns the exact same token value,
 * preserving all characters including special characters and whitespace.
 *
 * Validates: Requirements 1.3
 */
describe('sessionStore round-trip property', () => {
  afterEach(() => {
    clearToken();
  });

  it('returns the exact token that was stored, for any token string', () => {
    fc.assert(
      fc.property(
        fc.string(),
        // A valid future expiry; generated so the round-trip holds across a range of timestamps.
        fc.integer({ min: 1, max: 365 * 24 * 3600_000 }),
        (token, ttlMs) => {
          // Start from a clean slate so each token round-trips independently.
          clearToken();

          const expiresAt = Date.now() + ttlMs;
          const stored = storeToken(token, expiresAt);
          expect(stored).toBe(true);

          // getToken(storeToken(t, expiresAt)) === t
          expect(getToken()).toBe(token);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('preserves special characters and whitespace in tokens', () => {
    const tokenArb = fc.stringOf(
      fc.constantFrom(
        ...'abcXYZ0189'.split(''),
        ' ',
        '\t',
        '\n',
        '\r',
        '.',
        '-',
        '_',
        '+',
        '/',
        '=',
        ':',
        ';',
        '"',
        "'",
        '\\',
        '{',
        '}',
        '<',
        '>',
        '€',
        '𝕏',
      ),
      { maxLength: 200 },
    );

    fc.assert(
      fc.property(tokenArb, (token) => {
        clearToken();

        const expiresAt = Date.now() + 3600_000;
        const stored = storeToken(token, expiresAt);
        expect(stored).toBe(true);
        expect(getToken()).toBe(token);
      }),
      { numRuns: 100 },
    );
  });
});
