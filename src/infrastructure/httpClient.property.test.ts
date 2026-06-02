import fc from 'fast-check';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import {
  attachAuthHeader,
  clearCachedToken,
  ensureToken,
  tokenClient,
} from './httpClient';

/**
 * Feature: rita-adobe, Property 8: Authentication token header inclusion
 *
 * For any outbound API request configuration built while a valid token exists,
 * the resulting request headers SHALL include that token in the Authorization
 * header.
 *
 * `attachAuthHeader` is the exact (async) request interceptor registered on the
 * Axios `httpClient` (`httpClient.interceptors.request.use(attachAuthHeader)`),
 * so exercising it directly verifies the real interceptor behavior. The token
 * is fetched/cached by the client itself; the token endpoint is stubbed so a
 * known token is in the cache for the duration of each run.
 *
 * Validates: Requirements 1.5
 */

/**
 * Non-empty token strings drawn from a bearer-token-like alphabet (JWT /
 * `token68` style characters per RFC 6750) plus a couple of multi-byte unicode
 * characters. Spaces and CR/LF/control characters are excluded: they are not
 * valid in `token68` credentials, and axios (>= 1.16) trims header whitespace.
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

const requestConfigArb = fc.record({
  url: fc.oneof(
    fc.constant('/ades-support/account/check'),
    fc.constant('/ades-support/account-12h'),
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

const originalTokenAdapter = tokenClient.defaults.adapter;

/** Stub the token endpoint so `ensureToken` resolves to `token`. */
function stubToken(token: string): void {
  tokenClient.defaults.adapter = jest.fn((config) =>
    Promise.resolve({
      data: { data: { token, expiresIn: 600 } },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    } as never),
  );
}

afterEach(() => {
  tokenClient.defaults.adapter = originalTokenAdapter;
  clearCachedToken();
});

describe('httpClient auth header inclusion property', () => {
  it('injects the fetched token into the Authorization header of any request config', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, requestConfigArb, async (token, partial) => {
        // A known token is available in the cache for this run.
        clearCachedToken();
        stubToken(token);
        await ensureToken();

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

        const result = await attachAuthHeader(config);

        const authHeader = result.headers.get('Authorization');

        expect(authHeader).toBe(`Bearer ${token}`);
        expect(String(authHeader)).toContain(token);
      }),
      { numRuns: 100 },
    );
  });
});
