import fc from 'fast-check';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { attachAuthHeader } from './httpClient';
import { clearToken, storeToken } from './sessionStore';

/**
 * Feature: rita-adobe, Property 8: Authentication token header inclusion
 *
 * For any outbound API request configuration built while a valid token exists
 * in session storage, the resulting request headers SHALL include that token in
 * the Authorization header.
 *
 * `attachAuthHeader` is the exact request interceptor registered on the Axios
 * `httpClient` (`httpClient.interceptors.request.use(attachAuthHeader)`), so
 * exercising it directly verifies the real interceptor behavior.
 *
 * Validates: Requirements 1.5
 */

/**
 * Non-empty token strings drawn from a token-like alphabet (JWT/bearer style
 * characters plus whitespace) but free of CR/LF/control characters, which are
 * not valid in HTTP header values.
 */
const tokenArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
    '.',
    '-',
    '_',
    '+',
    '/',
    '=',
    ':',
    ' ',
    '€',
    '𝕏',
  ),
  { minLength: 1, maxLength: 200 },
);

/** Safe header-name characters (token chars per RFC 7230), excluding Authorization. */
const headerNameArb = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
      '-',
    ),
    { minLength: 1, maxLength: 20 },
  )
  .filter((name) => name.toLowerCase() !== 'authorization');

const headerValueArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_'.split(''),
  ),
  { maxLength: 50 },
);

/**
 * Arbitrary outbound request configurations: varied method, url, params, body,
 * and a (possibly absent) initial set of unrelated headers — covering the
 * branch where the interceptor must create the headers object itself.
 */
const requestConfigArb = fc.record({
  url: fc.oneof(
    fc.constant('/ades-support/account/check'),
    fc.constant('/ades-support/auth/token'),
    fc.webUrl(),
    fc.string(),
  ),
  method: fc.constantFrom('get', 'post', 'put', 'delete', 'patch', undefined),
  headers: fc.option(fc.dictionary(headerNameArb, headerValueArb, { maxKeys: 5 }), {
    nil: undefined,
  }),
  params: fc.option(fc.dictionary(fc.string(), fc.string(), { maxKeys: 3 }), {
    nil: undefined,
  }),
  data: fc.option(fc.json(), { nil: undefined }),
});

describe('httpClient auth header inclusion property', () => {
  afterEach(() => {
    clearToken();
  });

  it('injects the stored token into the Authorization header of any request config', () => {
    fc.assert(
      fc.property(tokenArb, requestConfigArb, (token, partial) => {
        // A valid token exists in the session store for the duration of the request.
        clearToken();
        expect(storeToken(token, Date.now() + 60_000)).toBe(true);

        const config = {
          url: partial.url,
          method: partial.method,
          headers:
            partial.headers === undefined
              ? undefined
              : AxiosHeaders.from(partial.headers),
          params: partial.params,
          data: partial.data,
        } as unknown as InternalAxiosRequestConfig;

        const result = attachAuthHeader(config);

        const authHeader = result.headers.get('Authorization');

        // The resulting headers include the token in the Authorization header.
        expect(authHeader).toBe(`Bearer ${token}`);
        expect(String(authHeader)).toContain(token);
      }),
      { numRuns: 100 },
    );
  });
});
