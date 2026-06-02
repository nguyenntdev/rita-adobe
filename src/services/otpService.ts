/**
 * OTP service.
 *
 * Reads one-time passwords for an account from the ADES Support API.
 * `readOTP` issues a request to `/mail/read-otp-gpm?email={email}`
 * (Requirement 6.2) and normalizes the outcome into an {@link OTPResult}:
 *
 *  - success with an `otp` value when the API returns an OTP,
 *  - success WITHOUT an `otp` value for the "no OTP found" state
 *    (Requirement 6.4),
 *  - failure carrying the API-provided error message when the request fails
 *    (Requirement 6.5).
 *
 * It builds on the shared {@link httpClient}, so the request automatically
 * carries the `Authorization` header and inherits the standard error mapping.
 */
import type { OTPResult, OTPService } from '../types';

import { httpClient, HttpError } from '../infrastructure/httpClient';

/** Path for the OTP read endpoint (Requirement 6.2). */
const READ_OTP_PATH = '/mail/read-otp-gpm';

/**
 * Extract the OTP value from an API response payload.
 *
 * Supports the common response shapes returned by the endpoint:
 *  - a bare string OTP,
 *  - an object exposing the OTP under `otp`, `code`, or `value`.
 *
 * Returns `undefined` when no usable OTP is present, which the caller maps to
 * the "no OTP found" state (Requirement 6.4).
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
 * @param email The account email to read the OTP for.
 * @returns An {@link OTPResult} describing the OTP value, the no-OTP state, or
 *   the failure reason.
 */
export async function readOTP(email: string): Promise<OTPResult> {
  try {
    const response = await httpClient.get(READ_OTP_PATH, {
      params: { email },
    });

    const otp = extractOtp(response.data);
    if (otp === undefined) {
      // Successful request but no OTP available (Requirement 6.4).
      return { success: true };
    }

    return { success: true, otp };
  } catch (error) {
    // Surface the API-provided failure reason when available, otherwise the
    // mapped user-facing message (Requirement 6.5).
    if (error instanceof HttpError) {
      return { success: false, error: error.apiMessage ?? error.userMessage };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read OTP.',
    };
  }
}

/**
 * OTPService implementation backed by the shared HTTP client.
 */
export const otpService: OTPService = {
  readOTP,
};
