/**
 * Unit tests for the HTTP client infrastructure (Task 4.3).
 *
 * Covers:
 *  - 401 handling on the authenticated `httpClient`: the session token is
 *    cleared (via the session store) and a redirect-to-login is signalled
 *    (Requirement 1.6).
 *  - The external `variableClient` does NOT clear the session or redirect on
 *    401, since it is unauthenticated (Requirement 1.6 scoping / 4.2).
 *  - `mapAxiosError` maps network, timeout, 400, 404, and 500 failures to the
 *    correct user-facing messages per the design's error-handling table
 *    (Requirements 10.3, 10.4).
 */
import { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios';

import {
  ERROR_MESSAGES,
  HttpError,
  httpClient,
  mapAxiosError,
  setUnauthorizedHandler,
  variableClient,
} from './httpClient';
import { clearToken, getToken } from './sessionStore';

// The session store is mocked so we can assert token-clearing on 401 without
// touching real `sessionStorage`, and so the request interceptor never injects
// a real token.
jest.mock('./sessionStore', () => ({
  clearToken: jest.fn(() => true),
  getToken: jest.fn(() => null),
}));

const mockedClearToken = clearToken as jest.Mock;
const mockedGetToken = getToken as jest.Mock;

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

// Preserve the real adapters so each test can install a rejecting adapter and
// then restore the originals, keeping the shared instances clean.
const originalHttpAdapter = httpClient.defaults.adapter;
const originalVariableAdapter = variableClient.defaults.adapter;

/** Install an adapter that rejects every request with `error`. */
function rejectWith(client: AxiosInstance, error: AxiosError): void {
  client.defaults.adapter = jest.fn(() => Promise.reject(error));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetToken.mockReturnValue(null);
});

afterEach(() => {
  setUnauthorizedHandler(null);
  httpClient.defaults.adapter = originalHttpAdapter;
  variableClient.defaults.adapter = originalVariableAdapter;
});

describe('httpClient 401 handling (Requirement 1.6)', () => {
  it('clears the session token and invokes the redirect handler on 401', async () => {
    const redirect = jest.fn();
    setUnauthorizedHandler(redirect);
    rejectWith(httpClient, makeAxiosError({ status: 401, data: { error: 'expired' } }));

    await expect(httpClient.get('/ades-support/account/check')).rejects.toMatchObject({
      userMessage: ERROR_MESSAGES.unauthorized,
      status: 401,
    });

    expect(mockedClearToken).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('rejects with an HttpError carrying the unauthorized message on 401', async () => {
    setUnauthorizedHandler(jest.fn());
    rejectWith(httpClient, makeAxiosError({ status: 401, data: {} }));

    await expect(httpClient.get('/x')).rejects.toBeInstanceOf(HttpError);
  });

  it('does NOT clear the session or redirect on a non-401 failure', async () => {
    const redirect = jest.fn();
    setUnauthorizedHandler(redirect);
    rejectWith(httpClient, makeAxiosError({ status: 500, data: {} }));

    await expect(httpClient.get('/x')).rejects.toMatchObject({
      userMessage: ERROR_MESSAGES.serverError,
      status: 500,
    });

    expect(mockedClearToken).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('variableClient 401 handling (Requirement 1.6 scoping)', () => {
  it('maps the 401 error but does not clear the session or redirect', async () => {
    const redirect = jest.fn();
    setUnauthorizedHandler(redirect);
    rejectWith(variableClient, makeAxiosError({ status: 401, data: {} }));

    await expect(variableClient.get('/user%40example.com')).rejects.toMatchObject({
      userMessage: ERROR_MESSAGES.unauthorized,
      status: 401,
    });

    expect(mockedClearToken).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('mapAxiosError error-table mapping (Requirements 10.3, 10.4)', () => {
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
