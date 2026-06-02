import fc from 'fast-check';
import { validateEmail, EMAIL_MAX_LENGTH } from './emailValidation';

/**
 * Feature: rita-adobe, Property 1: Email validation correctness
 *
 * For any string input, validateEmail accepts it if and only if it matches the
 * grammar (local-part of alphanumerics/dots/hyphens/underscores/plus signs,
 * exactly one `@`, domain of alphanumerics/dots/hyphens with at least one dot
 * separating labels) AND its length does not exceed 254 AND it is non-empty /
 * not whitespace-only. Validation is deterministic: repeated calls with the
 * same input return the same result.
 *
 * Validates: Requirements 8.1, 8.3, 8.5, 8.6
 *
 * Strategy: rather than re-deriving the grammar regex (which would be circular),
 * inputs are produced by structured generators whose expected validity is known
 * by construction — known-valid emails, known-malformed emails, length
 * boundaries (254 vs 255), and empty/whitespace strings. Fully arbitrary strings
 * are also generated to exercise determinism without an independent oracle.
 */

// Allowed characters per the grammar.
const LOCAL_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-'.split('');
const DOMAIN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('');
// Characters that are illegal anywhere in an email per the grammar.
const ILLEGAL_CHARS = [
  ' ', '!', '#', '$', '%', '&', "'", '*', '/', '=', '?', '^', '`',
  '{', '|', '}', '~', '(', ')', '<', '>', '[', ']', ':', ';', '"', ',', '\\',
];

const localChar = fc.constantFrom(...LOCAL_CHARS);
const domainChar = fc.constantFrom(...DOMAIN_CHARS);

const localPart = fc
  .array(localChar, { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

const domainLabel = fc
  .array(domainChar, { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

// A domain with at least two labels guarantees at least one dot separator.
const domain = fc
  .array(domainLabel, { minLength: 2, maxLength: 4 })
  .map((labels) => labels.join('.'));

interface TestCase {
  input: string;
  // Known expected validity, or undefined when only determinism is checked.
  expected?: boolean;
}

// --- Known-valid emails -----------------------------------------------------
const validEmail: fc.Arbitrary<TestCase> = fc
  .tuple(localPart, domain)
  .map(([local, dom]) => `${local}@${dom}`)
  .filter((email) => email.length <= EMAIL_MAX_LENGTH)
  .map((input) => ({ input, expected: true }));

// --- Known-malformed emails -------------------------------------------------
// Missing `@`: a non-empty string drawn from the local alphabet (no `@`).
const missingAt: fc.Arbitrary<TestCase> = fc
  .array(localChar, { minLength: 1, maxLength: 30 })
  .map((chars) => ({ input: chars.join(''), expected: false }));

// Multiple `@`: local@domain@domain.
const multipleAt: fc.Arbitrary<TestCase> = fc
  .tuple(localPart, domain, domain)
  .map(([local, d1, d2]) => ({ input: `${local}@${d1}@${d2}`, expected: false }));

// No dot in domain: local@singlelabel.
const noDomainDot: fc.Arbitrary<TestCase> = fc
  .tuple(localPart, domainLabel)
  .map(([local, label]) => ({ input: `${local}@${label}`, expected: false }));

// Illegal character embedded in an otherwise-valid email.
const illegalChar: fc.Arbitrary<TestCase> = fc
  .tuple(localPart, fc.constantFrom(...ILLEGAL_CHARS), domain)
  .map(([local, bad, dom]) => ({ input: `${local}${bad}x@${dom}`, expected: false }));

// --- Length boundaries (254 valid, 255 too long) ----------------------------
// "@b.co" is a 5-char valid suffix; pad the local-part to hit an exact length.
const boundaryValid254: fc.Arbitrary<TestCase> = fc
  .constantFrom(...LOCAL_CHARS)
  .map((ch) => ({ input: `${ch.repeat(EMAIL_MAX_LENGTH - 5)}@b.co`, expected: true }));

const boundaryTooLong255: fc.Arbitrary<TestCase> = fc
  .constantFrom(...LOCAL_CHARS)
  .map((ch) => ({ input: `${ch.repeat(EMAIL_MAX_LENGTH - 4)}@b.co`, expected: false }));

// --- Empty / whitespace-only ------------------------------------------------
const emptyOrWhitespace: fc.Arbitrary<TestCase> = fc
  .stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 })
  .map((input) => ({ input, expected: false }));

// --- Fully arbitrary strings (determinism only) -----------------------------
const arbitraryString: fc.Arbitrary<TestCase> = fc
  .string({ maxLength: 300 })
  .map((input) => ({ input }));

const anyCase: fc.Arbitrary<TestCase> = fc.oneof(
  validEmail,
  missingAt,
  multipleAt,
  noDomainDot,
  illegalChar,
  boundaryValid254,
  boundaryTooLong255,
  emptyOrWhitespace,
  arbitraryString,
);

describe('validateEmail — Property 1: Email validation correctness', () => {
  it('accepts iff grammar + length + non-empty all hold, and is deterministic', () => {
    fc.assert(
      fc.property(anyCase, ({ input, expected }) => {
        const result = validateEmail(input);

        // Acceptance correctness for cases with a known expected validity.
        if (expected !== undefined) {
          expect(result.isValid).toBe(expected);
        }

        // An invalid result always carries a non-empty error message; a valid
        // result never does.
        if (result.isValid) {
          expect(result.error).toBeUndefined();
        } else {
          expect(typeof result.error).toBe('string');
          expect(result.error && result.error.length).toBeGreaterThan(0);
        }

        // Determinism: repeated calls with the same input agree.
        const second = validateEmail(input);
        expect(second).toEqual(result);
      }),
      { numRuns: 200 },
    );
  });
});
