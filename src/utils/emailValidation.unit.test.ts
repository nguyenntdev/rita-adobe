import {
  validateEmail,
  EMAIL_MAX_LENGTH,
  EMAIL_REQUIRED_MESSAGE,
  EMAIL_INVALID_FORMAT_MESSAGE,
  EMAIL_TOO_LONG_MESSAGE,
} from './emailValidation';

/**
 * Unit tests for the email validation utility (task 2.3).
 *
 * Covers specific valid/invalid examples and each distinct error message:
 * required (Req 8.6), invalid format (Req 8.2/8.3), and too long (Req 8.5).
 */
describe('validateEmail', () => {
  describe('valid examples', () => {
    const validEmails = [
      'user@example.com',
      'first.last@example.com',
      'user+tag@example.com',
      'user_name@example.com',
      'user-name@example.com',
      'a@b.co',
      'support.staff+adobe@sub.domain.example.com',
      '123@example.com',
      'mixedCASE123@Example.COM',
      'a.b-c_d+e@example-domain.co.uk',
    ];

    it.each(validEmails)('accepts %s as a valid email', (email) => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts an email exactly at the 254-character boundary', () => {
      // domain "@example.com" is 12 chars; pad the local-part to reach 254.
      const domain = '@example.com';
      const localPart = 'a'.repeat(EMAIL_MAX_LENGTH - domain.length);
      const email = `${localPart}${domain}`;
      expect(email).toHaveLength(EMAIL_MAX_LENGTH);

      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('required error (Req 8.6)', () => {
    const emptyInputs: Array<[string, string]> = [
      ['empty string', ''],
      ['single space', ' '],
      ['multiple spaces', '     '],
      ['tab characters', '\t\t'],
      ['newline characters', '\n'],
      ['mixed whitespace', ' \t\n '],
    ];

    it.each(emptyInputs)('rejects %s with the required message', (_label, input) => {
      const result = validateEmail(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(EMAIL_REQUIRED_MESSAGE);
    });
  });

  describe('too long error (Req 8.5)', () => {
    it('rejects an email exceeding 254 characters with the too-long message', () => {
      const domain = '@example.com';
      const localPart = 'a'.repeat(EMAIL_MAX_LENGTH - domain.length + 1);
      const email = `${localPart}${domain}`;
      expect(email.length).toBe(EMAIL_MAX_LENGTH + 1);

      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(EMAIL_TOO_LONG_MESSAGE);
    });

    it('prioritizes the too-long message over format for an over-length malformed email', () => {
      // No "@" at all, but well over the max length.
      const email = 'a'.repeat(EMAIL_MAX_LENGTH + 50);

      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(EMAIL_TOO_LONG_MESSAGE);
    });
  });

  describe('invalid format error (Req 8.2 / 8.3)', () => {
    const invalidFormats: Array<[string, string]> = [
      ['missing @ symbol', 'userexample.com'],
      ['multiple @ symbols', 'user@@example.com'],
      ['two separated @ symbols', 'user@name@example.com'],
      ['missing domain', 'user@'],
      ['missing local-part', '@example.com'],
      ['no dot in domain', 'user@example'],
      ['trailing dot leaves empty label', 'user@example.'],
      ['leading dot leaves empty label', 'user@.com'],
      ['illegal local-part character (space)', 'user name@example.com'],
      ['illegal local-part character (comma)', 'user,name@example.com'],
      ['illegal domain character', 'user@exa$mple.com'],
      ['domain with underscore', 'user@exam_ple.com'],
      ['consecutive dots in domain', 'user@example..com'],
      ['whitespace around otherwise valid email', ' user@example.com '],
    ];

    it.each(invalidFormats)('rejects %s with the invalid-format message', (_label, input) => {
      const result = validateEmail(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(EMAIL_INVALID_FORMAT_MESSAGE);
    });
  });

  describe('determinism', () => {
    it('returns the same result for repeated calls with the same input', () => {
      expect(validateEmail('user@example.com')).toEqual(validateEmail('user@example.com'));
      expect(validateEmail('not-an-email')).toEqual(validateEmail('not-an-email'));
    });
  });
});
