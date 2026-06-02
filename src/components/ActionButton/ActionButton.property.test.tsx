import '@testing-library/jest-dom';

import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { ActionButton } from './ActionButton';
import { validateEmail, EMAIL_MAX_LENGTH } from '../../utils/emailValidation';

/**
 * Feature: rita-adobe, Property 6: Action button enablement invariant
 *
 * For any combination of email input value and request (loading) state, an
 * email-associated action button is enabled if and only if the email is valid
 * (per `validateEmail`, Property 1) AND no request for that action is currently
 * in progress (i.e. not loading). Otherwise the button is disabled.
 *
 * An email-associated action button is modelled here the way pages wire it up:
 * its `disabled` prop is driven by email validity (`!validateEmail(email).isValid`)
 * and its `loading` prop reflects whether a request is in flight. The
 * `ActionButton` itself disables when `loading || disabled`, so the composed
 * behaviour must satisfy: enabled iff (email valid AND not loading).
 *
 * Validates: Requirements 8.4, 10.1, 12.2
 *
 * Strategy: emails are produced by structured generators with known validity —
 * grammar-valid emails, malformed emails (missing/extra `@`, no domain dot,
 * illegal chars), and fully arbitrary strings — each paired with an arbitrary
 * loading boolean. The oracle for the expected enabled state is computed from
 * the same `validateEmail` function the component is wired against, so the
 * property checks the composition rather than re-deriving the grammar.
 */

const LOCAL_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-'.split('');
const DOMAIN_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('');
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

const domain = fc
  .array(domainLabel, { minLength: 2, maxLength: 4 })
  .map((labels) => labels.join('.'));

// Grammar-valid emails (bounded to the max length).
const validEmail: fc.Arbitrary<string> = fc
  .tuple(localPart, domain)
  .map(([local, dom]) => `${local}@${dom}`)
  .filter((email) => email.length <= EMAIL_MAX_LENGTH);

// Known-malformed emails.
const missingAt: fc.Arbitrary<string> = fc
  .array(localChar, { minLength: 1, maxLength: 30 })
  .map((chars) => chars.join(''));

const multipleAt: fc.Arbitrary<string> = fc
  .tuple(localPart, domain, domain)
  .map(([local, d1, d2]) => `${local}@${d1}@${d2}`);

const noDomainDot: fc.Arbitrary<string> = fc
  .tuple(localPart, domainLabel)
  .map(([local, label]) => `${local}@${label}`);

const illegalChar: fc.Arbitrary<string> = fc
  .tuple(localPart, fc.constantFrom(...ILLEGAL_CHARS), domain)
  .map(([local, bad, dom]) => `${local}${bad}x@${dom}`);

const emptyOrWhitespace: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { minLength: 0, maxLength: 10 },
);

const arbitraryString: fc.Arbitrary<string> = fc.string({ maxLength: 300 });

const anyEmail: fc.Arbitrary<string> = fc.oneof(
  validEmail,
  missingAt,
  multipleAt,
  noDomainDot,
  illegalChar,
  emptyOrWhitespace,
  arbitraryString,
);

describe('ActionButton — Property 6: Action button enablement invariant', () => {
  it('is enabled iff the email is valid AND no request is loading', () => {
    fc.assert(
      fc.property(anyEmail, fc.boolean(), (email, loading) => {
        const emailValid = validateEmail(email).isValid;
        const expectedEnabled = emailValid && !loading;

        // Wire the button the way an email-associated action does: validity
        // drives `disabled`, in-flight request drives `loading`.
        render(
          <ActionButton
            label="Action"
            onClick={() => {}}
            loading={loading}
            disabled={!emailValid}
          />,
        );

        const button = screen.getByRole('button', { name: /action/i });

        if (expectedEnabled) {
          expect(button).toBeEnabled();
          expect(button).toHaveAttribute('aria-disabled', 'false');
        } else {
          expect(button).toBeDisabled();
          expect(button).toHaveAttribute('aria-disabled', 'true');
        }

        // Unmount this iteration's render so the next one starts clean.
        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
