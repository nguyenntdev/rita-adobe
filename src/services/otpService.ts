/**
 * OTP service.
 *
 * Reads one-time passwords for an account from the live ADES Support API.
 * Verified contract (probed against the running API):
 *   GET `/mail/read-otp-gpm?email={email}` ->
 *     `{ status, message, data: { success, error?, otp?/code? } }`
 *
 * When no code email exists the API returns `data: { success: false, error }`
 * (a Vietnamese/English reason), which maps to the "no OTP found" state.
 *
 * The bearer token required by the endpoint is attached automatically by the
 * shared HTTP client.
 */
import type { OTPResult, OTPService } from '../types';

import { httpClient, HttpError } from '../infrastructure/httpClient';

/** Path for the OTP read endpoint. */
const READ_OTP_PATH = '/mail/read-otp-gpm';

/** Unwrap the `{ status, message, data }` envelope to the inner payload. */
function unwrapEnvelope(body: unknown): unknown {
  if (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'data' in (body as Record<string, unknown>)
  ) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

/**
 * Extract the OTP value from a payload. Supports a bare string or an object
 * exposing the OTP under `otp`, `code`, or `value`. Returns `undefined` when no
 * usable OTP is present.
 */
function extractOtp(data: unknown): string | undefined {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['otp', 'code', 'value'] as const) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate.trim();
      }
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return String(candidate);
      }
    }
  }

  return undefined;
}

/**
 * Read the OTP for the given email.
 *
 * @returns An {@link OTPResult} describing the OTP value, the no-OTP state, or
 *   the failure reason.
 */
export async function readOTP(email: string): Promise<OTPResult> {
  try {
    const response = await httpClient.get(READ_OTP_PATH, {
      params: { email },
    });

    const payload = unwrapEnvelope(response.data);

    // The inner payload may itself signal failure (no code email found).
    if (
      payload !== null &&
      typeof payload === 'object' &&
      (payload as Record<string, unknown>).success === false
    ) {
      const inner = (payload as Record<string, unknown>).error;
      // Treat "no code found" as the no-OTP state rather than a hard error.
      return { success: true, error: typeof inner === 'string' ? inner : undefined };
    }

    const otp = extractOtp(payload);
    if (otp === undefined) {
      // Successful request but no OTP available.
      return { success: true };
    }

    return { success: true, otp };
  } catch (error) {
    if (error instanceof HttpError) {
      return { success: false, error: error.apiMessage ?? error.userMessage };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không đọc được OTP.',
    };
  }
}

/**
 * OTPService implementation backed by the shared HTTP client.
 */
export const otpService: OTPService = {
  readOTP,
};
