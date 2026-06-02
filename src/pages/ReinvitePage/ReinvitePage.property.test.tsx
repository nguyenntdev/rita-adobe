import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { ReinvitePage } from './ReinvitePage';
import { NotificationProvider } from '../../context/NotificationContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput/EmailInput';
import { validateEmail, EMAIL_MAX_LENGTH } from '../../utils/emailValidation';

/**
 * Feature: rita-adobe, Property 9: Confirmation dialog email consistency
 *
 * For any valid email entered in the email input field, triggering the reinvite
 * action SHALL open a confirmation dialog whose displayed text contains exactly
 * that email address.
 *
 * Validates: Requirements 5.2
 *
 * Strategy: generate grammar-valid emails (matching the local-part / `@` /
 * dotted-domain grammar enforced by `validateEmail` in
 * `src/utils/emailValidation.ts`, bounded to the 254-char maximum). For each,
 * the page is rendered, the email is pasted into the EmailInput, the validation
 * debounce is flushed so the reinvite button enables, and the reinvite action
 * is triggered. The resulting `dialog` text is asserted to contain the exact
 * email. The account service is mocked because opening the dialog must not (and
 * does not) issue a reinvite request.
 */

jest.mock('../../services/accountService', () => ({
  reinvite: jest.fn(),
}));

import { reinvite } from '../../services/accountService';

const mockReinvite = reinvite as jest.Mock;

// --- Generators: grammar-valid emails per src/utils/emailValidation.ts ---
const LOCAL_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-'.split('');
const DOMAIN_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('');

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

// Grammar-valid emails bounded to the maximum permitted length.
const validEmail: fc.Arbitrary<string> = fc
  .tuple(localPart, domain)
  .map(([local, dom]) => `${local}@${dom}`)
  .filter((email) => email.length <= EMAIL_MAX_LENGTH);

function renderPage() {
  return render(
    <NotificationProvider>
      <ReinvitePage />
    </NotificationProvider>,
  );
}

describe('ReinvitePage — Property 9: Confirmation dialog email consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('opens a dialog whose text contains exactly the entered valid email (Req 5.2)', async () => {
    await fc.assert(
      fc.asyncProperty(validEmail, async (email) => {
        // Sanity: the generator only produces emails the validator accepts, so
        // the reinvite button will enable and the dialog can open.
        expect(validateEmail(email).isValid).toBe(true);

        const user = userEvent.setup({
          advanceTimers: jest.advanceTimersByTime,
        });
        renderPage();

        // Enter the email. `paste` avoids per-character debounce churn.
        const input = screen.getByRole('textbox', { name: /email address/i });
        await user.click(input);
        await user.paste(email);

        // Flush the EmailInput validation debounce so onValidationChange fires
        // and the reinvite button becomes enabled.
        act(() => {
          jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
        });

        const button = screen.getByRole('button', { name: /reinvite/i });
        expect(button).toBeEnabled();

        // Trigger the reinvite action.
        await user.click(button);

        // The confirmation dialog opens and its text contains exactly the email.
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveTextContent(email);

        // Opening the dialog must not issue a reinvite request.
        expect(mockReinvite).not.toHaveBeenCalled();

        // Reset DOM and mocks for the next iteration.
        cleanup();
        mockReinvite.mockClear();
      }),
      { numRuns: 100 },
    );
  });
});
