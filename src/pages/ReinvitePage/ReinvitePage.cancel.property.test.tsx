import '@testing-library/jest-dom';

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { ReinvitePage } from './ReinvitePage';
import {
  NotificationProvider,
  useNotifications,
  type NotificationContextValue,
} from '../../context/NotificationContext';
import {
  validateEmail,
  EMAIL_MAX_LENGTH,
} from '../../utils/emailValidation';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput/EmailInput';

/**
 * Feature: rita-adobe, Property 10: Cancel operation state preservation
 *
 * For any application state, opening the reinvite confirmation dialog and then
 * cancelling it leaves the application state (email input value, form/button
 * state, and emitted notifications) deep-equal to the state before the dialog
 * was opened, and issues NO reinvite request.
 *
 * The account service is mocked so the property can assert the cancel path
 * never reaches `reinvite`. The observable application state is captured as a
 * plain snapshot (email value, reinvite-button disabled flag, dialog presence,
 * and the notification stack); the property asserts the post-cancel snapshot is
 * deep-equal to the pre-dialog snapshot.
 *
 * Validates: Requirements 5.7
 *
 * Strategy: generate grammar-valid emails (a valid email is required for the
 * dialog to open at all) using structured local-part/domain generators, then
 * filter through the real `validateEmail` so only inputs the page accepts are
 * exercised. Each run types the email, snapshots state, opens the dialog,
 * cancels, and re-snapshots.
 */

jest.mock('../../services/accountService', () => ({
  reinvite: jest.fn(),
}));

import { reinvite } from '../../services/accountService';

const mockReinvite = reinvite as jest.Mock;

// --- Generators -------------------------------------------------------------

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

// Grammar-valid emails (bounded to the max length) that the page accepts. The
// real validator is applied as a filter so we only ever exercise the dialog
// path the property is about.
const validEmail: fc.Arbitrary<string> = fc
  .tuple(localPart, domain)
  .map(([local, dom]) => `${local}@${dom}`)
  .filter(
    (email) => email.length <= EMAIL_MAX_LENGTH && validateEmail(email).isValid,
  );

// --- Test harness -----------------------------------------------------------

// Captures the live notification context so the snapshot can include any toasts.
let notifications: NotificationContextValue | null = null;

function CaptureNotifications() {
  notifications = useNotifications();
  return null;
}

function renderPage() {
  return render(
    <NotificationProvider>
      <CaptureNotifications />
      <ReinvitePage />
    </NotificationProvider>,
  );
}

interface PageSnapshot {
  emailValue: string;
  reinviteButtonDisabled: boolean;
  dialogPresent: boolean;
  notifications: Array<{ type: string; message: string }>;
}

/**
 * Snapshot the observable application state. Only safe to call while the
 * confirmation dialog is closed (so the page's "Reinvite" button is the sole
 * /reinvite/i match).
 */
function snapshotState(): PageSnapshot {
  const input = screen.getByRole('textbox', {
    name: /email address/i,
  }) as HTMLInputElement;
  const button = screen.getByRole('button', {
    name: /reinvite/i,
  }) as HTMLButtonElement;

  return {
    emailValue: input.value,
    reinviteButtonDisabled: button.disabled,
    dialogPresent: screen.queryByRole('dialog') !== null,
    notifications: (notifications?.notifications ?? []).map((n) => ({
      type: n.type,
      message: n.message,
    })),
  };
}

describe('ReinvitePage — Property 10: Cancel operation state preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    notifications = null;
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('open-then-cancel restores the pre-dialog state and issues no reinvite request', async () => {
    await fc.assert(
      fc.asyncProperty(validEmail, async (email) => {
        const user = userEvent.setup({
          advanceTimers: jest.advanceTimersByTime,
        });
        renderPage();

        // Enter a valid email and flush the EmailInput validation debounce so
        // the reinvite button becomes enabled.
        const input = screen.getByRole('textbox', { name: /email address/i });
        await user.click(input);
        await user.paste(email);
        act(() => {
          jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
        });

        // Pre-dialog state: dialog closed, button enabled (valid email).
        const before = snapshotState();
        expect(before.dialogPresent).toBe(false);

        // Open the confirmation dialog.
        await user.click(screen.getByRole('button', { name: /reinvite/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Cancel it.
        await user.click(screen.getByRole('button', { name: /cancel/i }));

        // Post-cancel state must be deep-equal to the pre-dialog state, and no
        // reinvite request may have been issued.
        const after = snapshotState();
        expect(after).toEqual(before);
        expect(mockReinvite).not.toHaveBeenCalled();

        // Reset between runs so each iteration starts from a clean DOM/mock.
        cleanup();
        mockReinvite.mockClear();
      }),
      { numRuns: 100 },
    );
  }, 60000);
});
