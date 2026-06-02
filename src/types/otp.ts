/**
 * OTP service contract and result type.
 *
 * Covers the OTPService interface used to read one-time passwords for an
 * account (Requirements 6.2, 6.4, 6.5).
 */

/**
 * Result of an OTP read (Requirement 6.4, 6.5).
 *
 * `otp` holds the retrieved value on success; an absent `otp` with `success`
 * true represents the "no OTP found" state.
 */
export interface OTPResult {
  success: boolean;
  otp?: string;
  error?: string;
}

/**
 * Handles OTP retrieval operations.
 */
export interface OTPService {
  readOTP(email: string): Promise<OTPResult>;
}
