/**
 * Integration tests for account and OTP endpoint wiring.
 *
 * Unlike the service unit tests (which replace the HTTP client methods with
 * `jest.fn()`), these exercise the REAL Axios instances and their interceptor
 * stack. Only low-level adapters are mocked, so:
 *
 *   - the async request interceptor that fetches + injects the bearer token
 *     actually runs, letting us verify authenticated requests carry a token and
 *     that `getVariables` (external `variableClient`) OMITS it, and
 *   - the response interceptor's error mapping actually runs, letting us verify
 *     empty-result and error normalization end-to-end.
 *
 * Verified live contract: account check / 12h are POST `{email}`, reinvite is
 * POST with the email in the path, OTP is GET with an email query param.
 */
import {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  clearCachedToken,
  httpClient,
  tokenClient,
  variableClient,
} from '../infrastructure/httpClient';
import {
  checkAccount,
  getAccount12h,
  getVariables,
  reinvite,
} from './accountService';
import { readOTP } from './otpService';

/** The token the stubbed token endpoint issues for each test. */
const TEST_TOKEN = 'integration-test-token';

/** The most recent request config seen by a mocked adapter. */
let lastConfig: InternalAxiosRequestConfig | null = null;

const originalHttpAdapter = httpClient.defaults.adapter;
const originalVariableAdapter = variableClient.defaults.adapter;
const originalTokenAdapter = tokenClient.defaults.adapter;

/** Stub the token endpoint so the request interceptor can attach a token. */
function stubTokenClient(): void {
  tokenClient.defaults.adapter = jest.fn((config) =>
    Promise.resolve({
      data: { data: { token: TEST_TOKEN, expiresIn: 600 } },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    } as never),
  );
}

/** Install an adapter that captures the request config and resolves with data. */
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

/** Install an adapter that captures the config and rejects with `error`. */
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

function authHeaderOf(config: InternalAxiosRequestConfig | null): string | null {
  if (!config) {
    return null;
  }
  const value = AxiosHeaders.from(config.headers as never).get('Authorization');
  return value == null ? null : (value as string);
}

function hasAuthHeader(config: InternalAxiosRequestConfig | null): boolean {
  if (!config) {
    return false;
  }
  return AxiosHeaders.from(config.headers as never).has('Authorization');
}

function fullUrlOf(config: InternalAxiosRequestConfig | null): string {
  if (!config) {
    return '';
  }
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

beforeEach(() => {
  lastConfig = null;
  clearCachedToken();
  stubTokenClient();
});

afterEach(() => {
  clearCachedToken();
  httpClient.defaults.adapter = originalHttpAdapter;
  variableClient.defaults.adapter = originalVariableAdapter;
  tokenClient.defaults.adapter = originalTokenAdapter;
});

describe('checkAccount endpoint wiring', () => {
  it('issues a POST to /ades-support/account/check with the email body and the auth header', async () => {
    resolveWith(httpClient, { status: 'active' });

    const result = await checkAccount('user@example.com');

    expect(lastConfig?.method).toBe('post');
    expect(lastConfig?.baseURL).toBe('https://api-2026-02.ades.support');
    expect(lastConfig?.url).toBe('/ades-support/account/check');
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

describe('getAccount12h endpoint wiring', () => {
  it('issues a POST to /ades-support/account-12h with the email body and the auth header', async () => {
    resolveWith(httpClient, []);

    const result = await getAccount12h('user@example.com');

    expect(lastConfig?.method).toBe('post');
    expect(lastConfig?.url).toBe('/ades-support/account-12h');
    expect(authHeaderOf(lastConfig)).toBe(`Bearer ${TEST_TOKEN}`);
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns the records array for a populated response', async () => {
    const records = [{ event: 'login' }, { event: 'logout' }];
    resolveWith(httpClient, records);

    const result = await getAccount12h('user@example.com');

    expect(result).toEqual({ success: true, data: records });
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

describe('getVariables endpoint wiring', () => {
  it('issues a GET to https://var.ctv.ac/{email} and OMITS the Authorization header', async () => {
    const httpAdapter = resolveWith(httpClient, {});
    resolveWith(variableClient, { region: 'us' });

    const result = await getVariables('user+tag@example.com');

    expect(httpAdapter).not.toHaveBeenCalled();
    expect(lastConfig?.method).toBe('get');
    expect(lastConfig?.baseURL).toBe('https://var.ctv.ac');
    expect(lastConfig?.url).toBe('/user%2Btag%40example.com');
    expect(fullUrlOf(lastConfig)).toBe(
      'https://var.ctv.ac/user%2Btag%40example.com',
    );
    // External base: no Authorization header.
    expect(hasAuthHeader(lastConfig)).toBe(false);
    expect(authHeaderOf(lastConfig)).toBeNull();
    expect(result).toEqual({ success: true, data: { region: 'us' } });
  });

  it('maps a network error to the failure reason', async () => {
    resolveWith(httpClient, {});
    rejectWith(variableClient, makeAxiosError({}));

    const result = await getVariables('user@example.com');

    expect(result).toEqual({
      success: false,
      error: 'Lỗi kết nối. Vui lòng kiểm tra đường truyền.',
    });
  });
});

describe('reinvite endpoint wiring', () => {
  it('issues a POST to /ades-support/reinvite/{email} with the encoded email and the auth header', async () => {
    resolveWith(httpClient, { message: 'Invitation queued.' });

    const result = await reinvite('user@example.com');

    expect(lastConfig?.method).toBe('post');
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

describe('readOTP endpoint wiring', () => {
  it('issues a GET to /mail/read-otp-gpm with the email query param and the auth header', async () => {
    resolveWith(httpClient, { otp: '123456' });

    const result = await readOTP('user@example.com');

    expect(lastConfig?.method).toBe('get');
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
