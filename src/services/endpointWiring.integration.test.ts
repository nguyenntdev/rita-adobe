/**
 * Integration tests for account and OTP endpoint wiring (Task 6.3).
 *
 * Unlike the service unit tests (`accountService.test.ts`, `otpService.test.ts`),
 * which replace the HTTP client methods with `jest.fn()`, these tests exercise
 * the REAL Axios instances and their interceptor stack. Only a low-level adapter
 * is mocked (the same technique used in `httpClient.test.ts`), so:
 *
 *   - the request interceptor that injects the `Authorization` header actually
 *     runs, letting us verify that authenticated requests carry the token and
 *     that `getVariables` (external `variableClient`) OMITS it (Req 4.2), and
 *   - the response interceptor's error mapping actually runs, letting us verify
 *     empty-result and error normalization end-to-end.
 *
 * For each operation we assert the outbound request targets the correct
 * endpoint/URL, then assert the normalized result for the success, empty, and
 * error cases.
 *
 * _Requirements: 2.2, 3.2, 4.2, 5.4, 6.2_
 */
import {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  httpClient,
  setUnauthorizedHandler,
  variableClient,
} from '../infrastructure/httpClient';
import { clearToken, storeToken } from '../infrastructure/sessionStore';
import {
  checkAccount,
  getAccount12h,
  getVariables,
  reinvite,
} from './accountService';
import { readOTP } from './otpService';

/** A token present in the session for the duration of each test. */
const TEST_TOKEN = 'integration-test-token';

/** The most recent request config seen by a mocked adapter. */
let lastConfig: InternalAxiosRequestConfig | null = null;

// Preserve the real adapters so each test can install a stub and restore them,
// keeping the shared client instances clean across the suite.
const originalHttpAdapter = httpClient.defaults.adapter;
const originalVariableAdapter = variableClient.defaults.adapter;

/**
 * Install an adapter on `client` that captures the (post-interceptor) request
 * config and resolves with `data` and `status`.
 */
function resolveWith(
  client: AxiosInstance,
  data: unknown,
  status = 200,
): jest.Mock {
  const adapter = jest.fn((config: InternalAxiosRequestConfig) => {
    lastConfig = config;
    return Promise.resolve({
      data,
      status,
      statusText: 'OK',
      headers: {},
      config,
    });
  });
  client.defaults.adapter = adapter as never;
  return adapter;
}

/**
 * Install an adapter on `client` that captures the request config and rejects
 * with `error`, driving the response error interceptor / error mapping.
 */
function rejectWith(client: AxiosInstance, error: AxiosError): jest.Mock {
  const adapter = jest.fn((config: InternalAxiosRequestConfig) => {
    lastConfig = config;
    return Promise.reject(error);
  });
  client.defaults.adapter = adapter as never;
  return adapter;
}

/** Build an AxiosError; a `status` attaches a response, otherwise it is a network error. */
function makeAxiosError(opts: {
  status?: number;
  data?: unknown;
  code?: string;
}): AxiosError {
  const config = { headers: new AxiosHeaders() } as never;
  const response =
    opts.status === undefined
      ? undefined
      : ({
          status: opts.status,
          statusText: '',
          data: opts.data,
          headers: {},
          config,
        } as never);
  return new AxiosError('request failed', opts.code, config, {}, response);
}

/** The `Authorization` header value on the captured config, or `null` if absent. */
function authHeaderOf(config: InternalAxiosRequestConfig | null): string | null {
  if (!config) {
    return null;
  }
  // AxiosHeaders#get returns `undefined` for an absent header; normalize to null.
  const value = AxiosHeaders.from(config.headers as never).get('Authorization');
  return value == null ? null : (value as string);
}

/** Whether the captured config carries an `Authorization` header at all. */
function hasAuthHeader(config: InternalAxiosRequestConfig | null): boolean {
  if (!config) {
    return false;
  }
  return AxiosHeaders.from(config.headers as never).has('Authorization');
}

/** The full request URL (base + path) for the captured config. */
function fullUrlOf(config: InternalAxiosRequestConfig | null): string {
  if (!config) {
    return '';
  }
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

beforeEach(() => {
  lastConfig = null;
  // A valid, unexpired token exists so authenticated requests would carry it.
  expect(storeToken(TEST_TOKEN, Date.now() + 60_000)).toBe(true);
});

afterEach(() => {
  clearToken();
  setUnauthorizedHandler(null);
  httpClient.defaults.adapter = originalHttpAdapter;
  variableClient.defaults.adapter = originalVariableAdapter;
});

describe('checkAccount endpoint wiring (Req 2.2)', () => {
  it('issues a GET to /ades-support/account/check with the email and the auth header', async () => {
    resolveWith(httpClient, { status: 'active' });

    const result = await checkAccount('user@example.com');

    expect(lastConfig?.method).toBe('get');
    expect(lastConfig?.baseURL).toBe('https://api-2026-02.ades.support');
    expect(lastConfig?.url).toBe('/ades-support/account/check');
    expect(lastConfig?.params).toEqual({ email: 'user@example.com' });
    // Authenticated request carries the session token (Req 1.5).
    expect(authHeaderOf(lastConfig)).toBe(`Bearer ${TEST_TOKEN}`);
    expect(result).toEqual({ success: true, data: { status: 'active' } });
  });

  it('maps a non-object body to the success-empty state', async () => {
    resolveWith(httpClient, null);

    const result = await checkAccount('user@example.com');

    expect(result).toEqual({ success: true, data: {} });
  });

  it('maps an API error to the failure reason returned by the API', async () => {
    rejectWith(
      httpClient,
      makeAxiosError({ status: 400, data: { error: 'account not found' } }),
    );

    const result = await checkAccount('user@example.com');

    expect(result).toEqual({ success: false, error: 'account not found' });
  });
});

describe('getAccount12h endpoint wiring (Req 3.2)', () => {
  it('issues a GET to /ades-support/account-12h with the email and the auth header', async () => {
    resolveWith(httpClient, []);

    const result = await getAccount12h('user@example.com');

    expect(lastConfig?.method).toBe('get');
    expect(lastConfig?.baseURL).toBe('https://api-2026-02.ades.support');
    expect(lastConfig?.url).toBe('/ades-support/account-12h');
    expect(lastConfig?.params).toEqual({ email: 'user@example.com' });
    expect(authHeaderOf(lastConfig)).toBe(`Bearer ${TEST_TOKEN}`);
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns the records array for a populated response', async () => {
    const records = [{ event: 'login' }, { event: 'logout' }];
    resolveWith(httpClient, records);

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: records });
  });

  it('maps the no-activity (empty) response to an empty array', async () => {
    resolveWith(httpClient, {});

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: [] });
  });

  it('maps a server error to the failure reason returned by the API', async () => {
    rejectWith(
      httpClient,
      makeAxiosError({ status: 500, data: { message: 'upstream timeout' } }),
    );

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: false, error: 'upstream timeout' });
  });
});

describe('getVariables endpoint wiring (Req 4.2)', () => {
  it('issues a GET to https://var.ctv.ac/{email} on the external client and OMITS the Authorization header', async () => {
    const httpAdapter = resolveWith(httpClient, {});
    resolveWith(variableClient, { region: 'us' });

    const result = await getVariables('user+tag@example.com');

    // The authenticated ADES client is NOT used for variable data.
    expect(httpAdapter).not.toHaveBeenCalled();
    expect(lastConfig?.method).toBe('get');
    expect(lastConfig?.baseURL).toBe('https://var.ctv.ac');
    expect(lastConfig?.url).toBe('/user%2Btag%40example.com');
    expect(fullUrlOf(lastConfig)).toBe('https://var.ctv.ac/user%2Btag%40example.com');
    // External base: no Authorization header even though a token exists.
    expect(hasAuthHeader(lastConfig)).toBe(false);
    expect(authHeaderOf(lastConfig)).toBeNull();
    expect(result).toEqual({ success: true, data: { region: 'us' } });
  });

  it('maps an empty body to the success-empty state', async () => {
    resolveWith(variableClient, '');

    const result = await getVariables('user@example.com');

    expect(result).toEqual({ success: true, data: {} });
  });

  it('maps a network error to the failure reason', async () => {
    rejectWith(variableClient, makeAxiosError({}));

    const result = await getVariables('user@example.com');

    expect(result).toEqual({
      success: false,
      error: 'Network error. Please check your connection.',
    });
  });
});

describe('reinvite endpoint wiring (Req 5.4)', () => {
  it('issues a POST to /ades-support/reinvite/{email} with the encoded email and the auth header', async () => {
    resolveWith(httpClient, { message: 'Invitation queued.' });

    const result = await reinvite('user@example.com');

    expect(lastConfig?.method).toBe('post');
    expect(lastConfig?.baseURL).toBe('https://api-2026-02.ades.support');
    expect(lastConfig?.url).toBe('/ades-support/reinvite/user%40example.com');
    expect(authHeaderOf(lastConfig)).toBe(`Bearer ${TEST_TOKEN}`);
    expect(result).toEqual({ success: true, message: 'Invitation queued.' });
  });

  it('maps an API error to the failure reason returned by the API', async () => {
    rejectWith(
      httpClient,
      makeAxiosError({ status: 400, data: { error: 'email already invited' } }),
    );

    const result = await reinvite('user@example.com');

    expect(result).toEqual({ success: false, error: 'email already invited' });
  });
});

describe('readOTP endpoint wiring (Req 6.2)', () => {
  it('issues a GET to /mail/read-otp-gpm with the email query param and the auth header', async () => {
    resolveWith(httpClient, { otp: '123456' });

    const result = await readOTP('user@example.com');

    expect(lastConfig?.method).toBe('get');
    expect(lastConfig?.baseURL).toBe('https://api-2026-02.ades.support');
    expect(lastConfig?.url).toBe('/mail/read-otp-gpm');
    expect(lastConfig?.params).toEqual({ email: 'user@example.com' });
    expect(authHeaderOf(lastConfig)).toBe(`Bearer ${TEST_TOKEN}`);
    expect(result).toEqual({ success: true, otp: '123456' });
  });

  it('maps a payload without an OTP to the no-OTP-found state', async () => {
    resolveWith(httpClient, {});

    const result = await readOTP('user@example.com');

    expect(result.success).toBe(true);
    expect(result.otp).toBeUndefined();
  });

  it('maps an API error to the failure reason returned by the API', async () => {
    rejectWith(
      httpClient,
      makeAxiosError({ status: 500, data: { message: 'mailbox unavailable' } }),
    );

    const result = await readOTP('user@example.com');

    expect(result).toEqual({ success: false, error: 'mailbox unavailable' });
  });
});
