/**
 * HTTP client infrastructure.
 *
 * Configures the Axios instance used for all ADES Support API calls:
 *  - Base URL and a 30-second default timeout (Requirement 2.6).
 *  - A request interceptor that injects the `Authorization` header from the
 *    session store whenever a token exists (Requirement 1.5).
 *  - A response interceptor that, on 401, clears the token and triggers a
 *    redirect to login (Requirement 1.6), and maps network/timeout/4xx/5xx
 *    failures to user-facing messages per the design's error table
 *    (Requirements 10.3, 10.4).
 *
 * It also exposes a separate `variableClient` for the external variable
 * service (`https://var.ctv.ac`) that is issued WITHOUT the Authorization
 * header (Requirement 4.2).
 */
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { appConfig } from '../utils/appConfig';
import { clearToken, getToken } from './sessionStore';

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

/** User-facing messages from the design's error-handling table. */
export const ERROR_MESSAGES = {
  unauthorized: 'Session expired. Please log in again.',
  notFound: 'No data found for the specified account.',
  serverError: 'Server error. Please try again later.',
  network: 'Network error. Please check your connection.',
  timeout: 'Request timed out. Please try again.',
  badRequest: 'Invalid request.',
  generic: 'Request failed. Please try again.',
} as const;

/**
 * Handler invoked when a 401 is received. Registered by the auth/app layer so
 * the infrastructure does not depend on the router directly.
 */
type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Register (or clear with `null`) the callback invoked after a 401 clears the
 * stored token. The app layer wires this to its router to redirect to login.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/**
 * Clear the session and trigger redirect-to-login after an unauthorized
 * response (Requirement 1.6).
 */
function handleUnauthorized(): void {
  clearToken();
  if (unauthorizedHandler) {
    unauthorizedHandler();
  } else if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}

/**
 * Inject the `Authorization` header from the session store when a token exists.
 *
 * Exported for unit/property testing of the token-header behavior
 * (Requirement 1.5).
 */
export function attachAuthHeader(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const token = getToken();
  if (token) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

/**
 * Extract a human-readable failure reason from an API error payload, supporting
 * the common shapes (`{ error }`, `{ message }`, `{ detail }`, `{ reason }`, or
 * a bare string).
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
 * Map a low-level Axios error to an `HttpError` with a user-facing message,
 * following the design's error-handling table.
 *
 * Exported for unit testing of the error-mapping behavior
 * (Requirements 10.3, 10.4).
 */
export function mapAxiosError(error: AxiosError): HttpError {
  // Timeout: Axios aborts the request once the configured timeout elapses.
  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
    return new HttpError(ERROR_MESSAGES.timeout, { originalError: error });
  }

  const response = error.response;

  // No response received -> treat as a network connectivity error.
  if (!response) {
    return new HttpError(ERROR_MESSAGES.network, { originalError: error });
  }

  const status = response.status;
  const apiMessage = extractApiMessage(response.data);

  if (status === 401) {
    return new HttpError(ERROR_MESSAGES.unauthorized, {
      status,
      apiMessage,
      originalError: error,
    });
  }

  if (status === 404) {
    return new HttpError(ERROR_MESSAGES.notFound, {
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

  // Other 4xx (including 400): surface the API-provided message when present.
  if (status >= 400) {
    return new HttpError(apiMessage ?? ERROR_MESSAGES.badRequest, {
      status,
      apiMessage,
      originalError: error,
    });
  }

  // Defensive fallback for any other unexpected status.
  return new HttpError(apiMessage ?? ERROR_MESSAGES.generic, {
    status,
    apiMessage,
    originalError: error,
  });
}

/**
 * Build the response error interceptor.
 *
 * @param triggerAuthRedirect When `true`, a 401 clears the session and triggers
 *   redirect-to-login. The external variable client opts out, since it is not
 *   authenticated and should not log the user out of the ADES session.
 */
function createResponseErrorInterceptor(triggerAuthRedirect: boolean) {
  return (error: AxiosError): Promise<never> => {
    if (triggerAuthRedirect && error.response?.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(mapAxiosError(error));
  };
}

/**
 * The primary client for the ADES Support API. Carries the auth header and the
 * 401 redirect behavior.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.requestTimeoutMs,
});

httpClient.interceptors.request.use(attachAuthHeader);
httpClient.interceptors.response.use(
  (response) => response,
  createResponseErrorInterceptor(true),
);

/**
 * Client for the external variable service (`https://var.ctv.ac`). Issued
 * WITHOUT the Authorization header (Requirement 4.2). It shares the same error
 * mapping but does not trigger an auth redirect on 401.
 */
export const variableClient: AxiosInstance = axios.create({
  baseURL: appConfig.variableBaseUrl,
  timeout: appConfig.requestTimeoutMs,
});

variableClient.interceptors.response.use(
  (response) => response,
  createResponseErrorInterceptor(false),
);
