/**
 * Unit tests for the HTTP client infrastructure.
 *
 * Covers:
 *  - Automatic token attachment: the client fetches a token from
 *    `/ades-support/auth/token` and injects it as a Bearer header.
 *  - 401 handling: the cached token is dropped and the request is retried once
 *    with a fresh token.
 *  - `mapAxiosError` maps network, timeout, 400, 404, and 500 failures to the
 *    correct user-facing messages.
 */
import { AxiosError, AxiosHeaders } from 'axios';

import {
  clearCachedToken,
  ERROR_MESSAGES,
  HttpError,
  httpClient,
  mapAxiosError,
  tokenClient,
} from './httpClient';

/**
 * Build an `AxiosError`. When `status` is provided a `response` is attached;
 * otherwise the error represents a no-response (network) failure.
 */
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

const originalHttpAdapter = httpClient.defaults.adapter;
const originalTokenAdapter = tokenClient.defaults.adapter;

/** Stub the token endpoint to return sequential tokens. */
function stubTokenClient(): () => number {
  let calls = 0;
  tokenClient.defaults.adapter = jest.fn((config) => {
    calls += 1;
    return Promise.resolve({
      data: { data: { token: `tok-${calls}`, expiresIn: 600 } },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    } as never);
  });
  return () => calls;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearCachedToken();
});

afterEach(() => {
  httpClient.defaults.adapter = originalHttpAdapter;
  tokenClient.defaults.adapter = originalTokenAdapter;
  clearCachedToken();
});

describe('httpClient automatic token + 401 retry', () => {
  it('fetches a token and attaches it as a Bearer header', async () => {
    stubTokenClient();
    const seen: string[] = [];
    httpClient.defaults.adapter = jest.fn((config) => {
      const auth = new AxiosHeaders(config.headers).get('Authorization');
      seen.push(String(auth));
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as never);
    });

    const res = await httpClient.post('/ades-support/account/check', {
      email: 'a@b.co',
    });

    expect(res.data).toEqual({ ok: true });
    expect(seen).toEqual(['Bearer tok-1']);
  });

  it('drops the cached token and retries once with a fresh token on 401', async () => {
    const tokenCalls = stubTokenClient();
    let protectedCalls = 0;
    httpClient.defaults.adapter = jest.fn((config) => {
      protectedCalls += 1;
      // First protected call 401s; the retry (with a fresh token) succeeds.
      if (protectedCalls === 1) {
        return Promise.reject(makeAxiosError({ status: 401, data: {} }));
      }
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as never);
    });

    const res = await httpClient.post('/ades-support/account/check', {
      email: 'a@b.co',
    });

    expect(res.data).toEqual({ ok: true });
    expect(protectedCalls).toBe(2); // original + one retry
    expect(tokenCalls()).toBeGreaterThanOrEqual(2); // refetched after 401
  });
});

describe('mapAxiosError error-table mapping', () => {
  it('maps a timeout (ECONNABORTED) to the timeout message', () => {
    const result = mapAxiosError(makeAxiosError({ code: AxiosError.ECONNABORTED }));

    expect(result).toBeInstanceOf(HttpError);
    expect(result.userMessage).toBe(ERROR_MESSAGES.timeout);
    expect(result.status).toBeUndefined();
  });

  it('maps a timeout (ETIMEDOUT) to the timeout message', () => {
    const result = mapAxiosError(makeAxiosError({ code: AxiosError.ETIMEDOUT }));

    expect(result.userMessage).toBe(ERROR_MESSAGES.timeout);
  });

  it('maps a missing response (network failure) to the network message', () => {
    const result = mapAxiosError(makeAxiosError({}));

    expect(result.userMessage).toBe(ERROR_MESSAGES.network);
    expect(result.status).toBeUndefined();
  });

  it('maps 401 to the unauthorized message', () => {
    const result = mapAxiosError(makeAxiosError({ status: 401, data: {} }));

    expect(result.userMessage).toBe(ERROR_MESSAGES.unauthorized);
    expect(result.status).toBe(401);
  });

  it('maps 400 to the API-provided error message when present', () => {
    const result = mapAxiosError(
      makeAxiosError({ status: 400, data: { error: 'email is invalid' } }),
    );

    expect(result.userMessage).toBe('email is invalid');
    expect(result.status).toBe(400);
    expect(result.apiMessage).toBe('email is invalid');
  });

  it('maps 400 without an API message to the generic bad-request message', () => {
    const result = mapAxiosError(makeAxiosError({ status: 400, data: {} }));

    expect(result.userMessage).toBe(ERROR_MESSAGES.badRequest);
    expect(result.status).toBe(400);
  });

  it('maps 404 to the not-found message', () => {
    const result = mapAxiosError(makeAxiosError({ status: 404, data: {} }));

    expect(result.userMessage).toBe(ERROR_MESSAGES.notFound);
    expect(result.status).toBe(404);
  });

  it('maps 500 to the server-error message', () => {
    const result = mapAxiosError(makeAxiosError({ status: 500, data: {} }));

    expect(result.userMessage).toBe(ERROR_MESSAGES.serverError);
    expect(result.status).toBe(500);
  });
});
