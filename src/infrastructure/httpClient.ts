/**
 * HTTP client infrastructure.
 *
 * Configures the Axios instance used for all ADES Support API calls and an
 * automatic token manager. The ADES API requires a bearer token, but it is
 * issued without credentials: `POST /ades-support/auth/token` (no body) returns
 * a short-lived token (~10 minutes). This module fetches and caches that token
 * transparently, so callers never deal with auth directly:
 *
 *  - Base URL and a 30-second default timeout.
 *  - An async request interceptor that ensures a valid token exists (fetching a
 *    fresh one when missing/expired) and injects the `Authorization` header.
 *  - A response interceptor that, on 401, drops the cached token and retries
 *    the request once with a fresh token, and maps network/timeout/4xx/5xx
 *    failures to user-facing messages.
 *
 * It also exposes a separate `variableClient` for the external variable service
 * (`https://var.ctv.ac`) that is issued WITHOUT the Authorization header.
 */
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { appConfig } from '../utils/appConfig';

/**
 * Error thrown by the HTTP client after mapping a low-level Axios failure to a
 * user-facing message.
 *
 * - `userMessage` is safe to surface directly in a toast/panel.
 * - `status` is the HTTP status code when a response was received.
 * - `apiMessage` is the raw failure reason returned by the API, when present.
 */
export class HttpError extends Error {
  readonly userMessage: string;
  readonly status?: number;
  readonly apiMessage?: string;
  readonly originalError?: unknown;

  constructor(
    userMessage: string,
    options: {
      status?: number;
      apiMessage?: string;
      originalError?: unknown;
    } = {},
  ) {
    super(userMessage);
    this.name = 'HttpError';
    this.userMessage = userMessage;
    this.status = options.status;
    this.apiMessage = options.apiMessage;
    this.originalError = options.originalError;
    // Restore the prototype chain for instanceof checks under transpilation.
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

/** User-facing messages (Vietnamese) for transport-level failures. */
export const ERROR_MESSAGES = {
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.',
  notFound: 'Không tìm thấy dữ liệu cho tài khoản này.',
  serverError: 'Lỗi máy chủ. Vui lòng thử lại sau.',
  network: 'Lỗi kết nối. Vui lòng kiểm tra đường truyền.',
  timeout: 'Yêu cầu quá thời gian chờ. Vui lòng thử lại.',
  badRequest: 'Yêu cầu không hợp lệ.',
  generic: 'Yêu cầu thất bại. Vui lòng thử lại.',
} as const;

/** Path of the ADES token endpoint. */
const TOKEN_ENDPOINT = '/ades-support/auth/token';

/**
 * Safety margin (ms) subtracted from the token expiry so a token is refreshed
 * shortly before it actually expires, avoiding 401s from clock skew/in-flight
 * latency.
 */
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

// --- In-memory token cache -------------------------------------------------

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;
/** Coalesces concurrent token fetches into a single in-flight request. */
let inFlightTokenFetch: Promise<string> | null = null;

/**
 * Bare axios instance used ONLY to fetch tokens. It deliberately has no request
 * interceptor, so fetching a token never recurses into the auth flow. Exported
 * so tests can stub its adapter.
 */
export const tokenClient: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.requestTimeoutMs,
});

/** Whether the cached token is present and not within the expiry buffer. */
function hasValidCachedToken(now: number = Date.now()): boolean {
  return cachedToken !== null && now < cachedTokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

/** Clear the cached token (e.g. after a 401) so the next call refetches. */
export function clearCachedToken(): void {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}

/**
 * Fetch a fresh token from the ADES token endpoint and cache it. Concurrent
 * callers share a single in-flight request.
 */
async function fetchToken(): Promise<string> {
  if (inFlightTokenFetch) {
    return inFlightTokenFetch;
  }

  inFlightTokenFetch = (async () => {
    try {
      const response = await tokenClient.post(TOKEN_ENDPOINT);
      const data = (response.data as { data?: unknown })?.data ?? response.data;
      const record = (data ?? {}) as Record<string, unknown>;

      const token =
        typeof record.token === 'string'
          ? record.token
          : typeof record.access_token === 'string'
            ? record.access_token
            : null;

      if (!token) {
        throw new HttpError(ERROR_MESSAGES.unauthorized);
      }

      // expiresIn is in seconds; default to 10 minutes when absent.
      const expiresInSec =
        typeof record.expiresIn === 'number'
          ? record.expiresIn
          : typeof record.expires_in === 'number'
            ? record.expires_in
            : 600;

      cachedToken = token;
      cachedTokenExpiresAt = Date.now() + expiresInSec * 1000;
      return token;
    } finally {
      inFlightTokenFetch = null;
    }
  })();

  return inFlightTokenFetch;
}

/**
 * Return a valid token, fetching a fresh one when the cache is missing/expired.
 */
export async function ensureToken(): Promise<string> {
  if (hasValidCachedToken()) {
    return cachedToken as string;
  }
  return fetchToken();
}

// --- Interceptors ----------------------------------------------------------

/**
 * Async request interceptor: ensure a valid token exists and inject the
 * `Authorization` header. Exported for testing.
 */
export async function attachAuthHeader(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  const token = await ensureToken();
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }
  config.headers.set('Authorization', `Bearer ${token}`);
  return config;
}

/**
 * Extract a human-readable failure reason from an API error payload, supporting
 * `{ error }`, `{ message }`, `{ detail }`, `{ reason }`, or a bare string.
 */
function extractApiMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['error', 'message', 'detail', 'reason'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Map a low-level Axios error to an `HttpError` with a user-facing message.
 * Exported for testing.
 */
export function mapAxiosError(error: AxiosError): HttpError {
  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
    return new HttpError(ERROR_MESSAGES.timeout, { originalError: error });
  }

  const response = error.response;
  if (!response) {
    return new HttpError(ERROR_MESSAGES.network, { originalError: error });
  }

  const status = response.status;
  const apiMessage = extractApiMessage(response.data);

  if (status === 401) {
    return new HttpError(apiMessage ?? ERROR_MESSAGES.unauthorized, {
      status,
      apiMessage,
      originalError: error,
    });
  }
  if (status === 404) {
    return new HttpError(apiMessage ?? ERROR_MESSAGES.notFound, {
      status,
      apiMessage,
      originalError: error,
    });
  }
  if (status >= 500) {
    return new HttpError(ERROR_MESSAGES.serverError, {
      status,
      apiMessage,
      originalError: error,
    });
  }
  if (status >= 400) {
    return new HttpError(apiMessage ?? ERROR_MESSAGES.badRequest, {
      status,
      apiMessage,
      originalError: error,
    });
  }
  return new HttpError(apiMessage ?? ERROR_MESSAGES.generic, {
    status,
    apiMessage,
    originalError: error,
  });
}

/**
 * The primary client for the ADES Support API. Carries the auto-fetched auth
 * token and retries once on 401 with a fresh token.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.requestTimeoutMs,
});

httpClient.interceptors.request.use(attachAuthHeader);
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retriedAfter401?: boolean })
      | undefined;

    // On 401, the cached token is stale/invalid: drop it and retry once with a
    // fresh token before surfacing the error.
    if (error.response?.status === 401 && config && !config._retriedAfter401) {
      clearCachedToken();
      config._retriedAfter401 = true;
      try {
        const token = await ensureToken();
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }
        config.headers.set('Authorization', `Bearer ${token}`);
        return httpClient.request(config);
      } catch {
        // Fall through to the mapped error below.
      }
    }

    return Promise.reject(mapAxiosError(error));
  },
);

/**
 * Client for the external variable service (`https://var.ctv.ac`). Issued
 * WITHOUT the Authorization header. Shares the error mapping.
 */
export const variableClient: AxiosInstance = axios.create({
  baseURL: appConfig.variableBaseUrl,
  timeout: appConfig.requestTimeoutMs,
});

variableClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(mapAxiosError(error)),
);
