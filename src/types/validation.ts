/**
 * Shared validation types.
 *
 * Used by the email validation utility (task 2.1) and any component that needs
 * to report whether an input is valid along with a human-readable error.
 */

/**
 * Result of validating a single input value.
 *
 * `error` is populated only when `isValid` is `false`.
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Configuration describing the rules applied to email validation.
 *
 * Mirrors the constraints in Requirement 8: a bounded length, a grammar
 * pattern, and whether a value is required.
 */
export interface EmailValidationRules {
  maxLength: 254;
  pattern: RegExp;
  required: boolean;
}
