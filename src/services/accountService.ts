/**
 * Account service.
 *
 * Implements the {@link AccountService} contract against the live ADES Support
 * API. Verified contract (probed against the running API):
 *   - `checkAccount`  -> POST `/ades-support/account/check`  body `{ email }`
 *      Returns the account object directly (email, status, productName, ...).
 *   - `getAccount12h` -> POST `/ades-support/account-12h`    body `{ email }`
 *      Returns `{ status, message, data }`; `data` is the records payload.
 *   - `getVariables`  -> GET  `https://var.ctv.ac/{email}` via the external
 *      variable client, WITHOUT the Authorization header.
 *   - `reinvite`      -> POST `/ades-support/reinvite/{email}` (email in path)
 *      Returns `{ status, message, data: { message, email } }`.
 *
 * The bearer token required by the ADES endpoints is fetched and attached
 * automatically by the shared HTTP client, so this service issues plain calls.
 *
 * Each operation normalizes the outcome into its result type, distinguishing
 * success-with-data, success-empty, and error-with-API-message. The ADES API
 * returns failure messages in Vietnamese, which are surfaced as-is.
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
 * {@link HttpError} carries the raw API message (Vietnamese) separately from
 * the mapped message, so prefer the API message.
 */
function resolveErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.apiMessage ?? error.userMessage;
  }
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Yêu cầu thất bại. Vui lòng thử lại.';
}

/**
 * Unwrap the common `{ status, message, data }` ADES envelope. When the body is
 * already the payload (e.g. account/check returns the object directly), it is
 * returned unchanged.
 */
function unwrapEnvelope(body: unknown): unknown {
  if (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'data' in (body as Record<string, unknown>) &&
    'message' in (body as Record<string, unknown>)
  ) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

/** Coerce an unknown payload into a key-value record (non-objects -> empty). */
function toRecord(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

/**
 * Coerce an unknown payload into an array of 12-hour records. Accepts a bare
 * array or a `{ records | data | accounts: [] }` envelope.
 */
function toRecordArray(data: unknown): Account12hRecord[] {
  if (Array.isArray(data)) {
    return data as Account12hRecord[];
  }
  if (data !== null && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['records', 'data', 'accounts', 'items'] as const) {
      if (Array.isArray(record[key])) {
        return record[key] as Account12hRecord[];
      }
    }
  }
  return [];
}

/**
 * Check account status. POST `{ email }`; the API returns the account object
 * directly.
 */
export async function checkAccount(email: string): Promise<AccountCheckResult> {
  try {
    const response = await httpClient.post(ENDPOINTS.accountCheck, { email });
    return { success: true, data: toRecord(unwrapEnvelope(response.data)) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Retrieve account activity within the last 12 hours. POST `{ email }`; the
 * records live under the envelope's `data`.
 */
export async function getAccount12h(email: string): Promise<Account12hResult> {
  try {
    const response = await httpClient.post(ENDPOINTS.account12h, { email });
    return { success: true, data: toRecordArray(unwrapEnvelope(response.data)) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Fetch variable data for an email from the external variable service. Uses the
 * variable client (no Authorization header).
 */
export async function getVariables(email: string): Promise<VariableResult> {
  try {
    const response = await variableClient.get(`/${encodeURIComponent(email)}`);
    return { success: true, data: toRecord(unwrapEnvelope(response.data)) };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Reinvite an account. POST with the email in the path; the confirmation
 * message lives under the envelope's `data.message`.
 */
export async function reinvite(email: string): Promise<ReinviteResult> {
  try {
    const response = await httpClient.post(
      `${ENDPOINTS.reinvite}/${encodeURIComponent(email)}`,
    );
    const apiMessage = extractMessage(unwrapEnvelope(response.data));
    return {
      success: true,
      message: apiMessage ?? `Đã gửi lời mời lại tới ${email}.`,
    };
  } catch (error) {
    return { success: false, error: resolveErrorMessage(error) };
  }
}

/**
 * Extract a human-readable confirmation message from a reinvite payload,
 * supporting `{ message }`, `{ detail }`, `{ status }`, or a bare string.
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
