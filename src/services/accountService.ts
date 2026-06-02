/**
 * Account service.
 *
 * Implements the {@link AccountService} contract against the ADES Support API
 * (and the external variable service for {@link getVariables}). Each operation
 * issues its request through the shared HTTP clients in
 * `src/infrastructure/httpClient.ts` and normalizes the outcome into the
 * operation's result type, distinguishing three cases:
 *
 *   - **success-with-data**  — the request succeeded and the API returned
 *     non-empty data.
 *   - **success-empty**      — the request succeeded but the API returned no
 *     data / an empty result (so the UI can render a "no data" message).
 *   - **error-with-API-message** — the request failed; the result carries the
 *     failure reason returned by the API when available, otherwise the mapped
 *     user-facing message.
 *
 * Endpoint conventions (the design fixes the endpoint paths but not the HTTP
 * methods; these are the choices made here):
 *   - `checkAccount`  -> GET  `/ades-support/account/check?email={email}`  (Req 2.2)
 *   - `getAccount12h` -> GET  `/ades-support/account-12h?email={email}`    (Req 3.2)
 *   - `getVariables`  -> GET  `https://var.ctv.ac/{email}` via the external
 *      variable client, issued WITHOUT the Authorization header             (Req 4.2)
 *   - `reinvite`      -> POST `/ades-support/reinvite/{email}`              (Req 5.4)
 *
 * (Requirements 2.2, 2.4, 3.2, 3.4, 3.5, 4.2, 4.4, 4.5, 5.4, 5.5, 5.6)
 */
import { HttpError, httpClient, variableClient } from '../infrastructure/httpClient';
import type {
  Account12hRecord,
  Account12hResult,
  AccountCheckResult,
  AccountService,
  ReinviteResult,
  VariableResult,
} from '../types';

/** ADES Support API endpoint paths used by this service. */
const ENDPOINTS = {
  accountCheck: '/ades-support/account/check',
  account12h: '/ades-support/account-12h',
  /** Built per-call with the (encoded) email appended. */
  reinvite: '/ades-support/reinvite',
} as const;

/**
 * Resolve the failure reason to surface to the user from a rejected request.
 *
 * Requirements 2.4, 3.5, 4.5, and 5.6 require the failure reason returned by
 * the API. {@link HttpError} carries the raw API message separately from the
 * mapped user-facing message, so prefer the API message and fall back to the
 * friendly message (and finally a generic message for non-HTTP errors).
 */
function resolveErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.apiMessage ?? error.userMessage;
  }
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Request failed. Please try again.';
}

/**
 * Coerce an unknown response body into a key-value record.
 *
 * Non-object bodies (including arrays, `null`, and primitives) normalize to an
 * empty record, which the success-empty branch treats as "no data".
 */
function toRecord(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

/**
 * Coerce an unknown response body into an array of 12-hour records.
 *
 * Accepts a bare array, or unwraps a common `{ records | data | accounts: [] }`
 * envelope; anything else normalizes to an empty array (the no-activity state).
 */
function toRecordArray(data: unknown): Account12hRecord[] {
  if (Array.isArray(data)) {
    return data as Account12hRecord[];
  }
  if (data !== null && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['records', 'data', 'accounts'] as const) {
      if (Array.isArray(record[key])) {
        return record[key] as Account12hRecord[];
      }
    }
  }
  return [];
}

/**
 * Check account status (Requirements 2.2, 2.4).
 *
 * Success returns the API's key-value record (empty when the API returned no
 * fields); failure returns the API failure reason.
 */
export async function checkAccount(email: string): Promise<AccountCheckResult> {
  try {
    const response = await httpClient.get(ENDPOINTS.accountCheck, {
      params: { email },
    });
    return { success: true, data: toRecord(response.data) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Retrieve account activity within the last 12 hours (Requirements 3.2, 3.4,
 * 3.5).
 *
 * Success returns the records array; an empty array represents the
 * "no activity" state. Failure returns the API failure reason.
 */
export async function getAccount12h(email: string): Promise<Account12hResult> {
  try {
    const response = await httpClient.get(ENDPOINTS.account12h, {
      params: { email },
    });
    return { success: true, data: toRecordArray(response.data) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Fetch variable data for an email from the external variable service
 * (Requirements 4.2, 4.4, 4.5).
 *
 * Uses {@link variableClient}, which targets `https://var.ctv.ac` and is issued
 * WITHOUT the Authorization header. Success returns the key-value record (empty
 * when the response carried no data); failure returns the failure reason.
 */
export async function getVariables(email: string): Promise<VariableResult> {
  try {
    const response = await variableClient.get(`/${encodeURIComponent(email)}`);
    return { success: true, data: toRecord(response.data) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Reinvite an account (Requirements 5.4, 5.5, 5.6).
 *
 * Success returns a confirmation message (the API-provided message when
 * present, otherwise a default naming the target email); failure returns the
 * API failure reason.
 */
export async function reinvite(email: string): Promise<ReinviteResult> {
  try {
    const response = await httpClient.post(
      `${ENDPOINTS.reinvite}/${encodeURIComponent(email)}`,
    );
    const apiMessage = extractMessage(response.data);
    return {
      success: true,
      message: apiMessage ?? `Reinvite sent to ${email}.`,
    };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Extract a human-readable confirmation message from a reinvite response body,
 * supporting `{ message }`, `{ detail }`, or a bare string. Returns `undefined`
 * when no usable message is present so callers can apply a default.
 */
function extractMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (data !== null && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['message', 'detail', 'status'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Concrete {@link AccountService} implementation bundling the operations above.
 */
export const accountService: AccountService = {
  checkAccount,
  getAccount12h,
  getVariables,
  reinvite,
};
