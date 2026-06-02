import type { ValidationResult } from '../types/validation';

/**
 * Email validation utility (design Property 1, Requirements 8.1, 8.3, 8.5, 8.6).
 *
 * Grammar (Requirement 8.3):
 *   - local-part: one or more of alphanumerics, dots, hyphens, underscores, plus signs
 *   - exactly one `@`
 *   - domain: labels of alphanumerics and hyphens separated by dots, with at least
 *     one dot separating two non-empty labels
 *
 * Additional rules:
 *   - empty / whitespace-only input is rejected (Requirement 8.6)
 *   - input exceeding 254 characters is rejected (Requirement 8.5)
 *
 * `validateEmail` is a pure, deterministic function: the same input always yields
 * an equal result.
 */

/** Maximum permitted total length of an email address (Requirement 8.5). */
export const EMAIL_MAX_LENGTH = 254;

/** Error message for empty / whitespace-only input (Requirement 8.6). */
export const EMAIL_REQUIRED_MESSAGE = 'Email address is required';

/** Error message when the address exceeds the maximum length (Requirement 8.5). */
export const EMAIL_TOO_LONG_MESSAGE = 'Email address exceeds maximum length';

/** Error message for an address that does not match the grammar (Requirement 8.3). */
export const EMAIL_INVALID_FORMAT_MESSAGE = 'Please enter a valid email address';

/**
 * Grammar pattern matching the rules in Requirement 8.3.
 *
 * The local-part character class excludes `@`, and the domain class excludes `@`,
 * so a match guarantees exactly one `@`. The domain requires at least one
 * `.label` group, guaranteeing at least one dot separating non-empty labels.
 *
 * In JavaScript (without the `m` flag) `$` anchors strictly to the end of the
 * string and does not match before a trailing newline, so line terminators are
 * correctly rejected.
 */
const EMAIL_PATTERN = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

/**
 * Validate an email address against the RITA Adobe grammar and length rules.
 *
 * @param input - the raw email string to validate
 * @returns a {@link ValidationResult}; `error` is populated only when invalid
 */
export function validateEmail(input: string): ValidationResult {
  if (input.trim().length === 0) {
    return { isValid: false, error: EMAIL_REQUIRED_MESSAGE };
  }

  if (input.length > EMAIL_MAX_LENGTH) {
    return { isValid: false, error: EMAIL_TOO_LONG_MESSAGE };
  }

  if (!EMAIL_PATTERN.test(input)) {
    return { isValid: false, error: EMAIL_INVALID_FORMAT_MESSAGE };
  }

  return { isValid: true };
}
