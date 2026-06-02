import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import fc from 'fast-check';

import { NotificationProvider } from '../../context/NotificationContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput/EmailInput';
import { validateEmail, EMAIL_MAX_LENGTH } from '../../utils/emailValidation';
import type {
  AccountService,
  ConnectionStatus,
  OTPService,
  WebSocketService,
  WSMessage,
} from '../../types';
import { DashboardPage } from './DashboardPage';

/**
 * Feature: rita-adobe, Property 12: Dashboard email persistence
 *
 * For any email address entered in the dashboard input field and any sequence
 * of operations performed within the same session, the email field value SHALL
 * remain equal to the entered email until explicitly cleared by the user.
 *
 * Validates: Requirements 12.6
 *
 * Strategy: generate a grammar-valid email (so the action buttons enable) plus
 * an arbitrary non-empty sequence drawn from the email-driven operations. The
 * dashboard is rendered with mocked services (no real network/WS), the email is
 * entered once, the validation debounce is flushed, then every operation in the
 * sequence is triggered. After the sequence the email input value is asserted
 * to still equal the entered email.
 */

// --- Generators: grammar-valid emails per src/utils/emailValidation.ts ---
const LOCAL_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-'.split('');
const DOMAIN_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('');

const localPart = fc
  .array(fc.constantFrom(...LOCAL_CHARS), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

const domainLabel = fc
  .array(fc.constantFrom(...DOMAIN_CHARS), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

const domain = fc
  .array(domainLabel, { minLength: 2, maxLength: 4 })
  .map((labels) => labels.join('.'));

const validEmail: fc.Arbitrary<string> = fc
  .tuple(localPart, domain)
  .map(([local, dom]) => `${local}@${dom}`)
  .filter((email) => email.length <= EMAIL_MAX_LENGTH);

/** Email-driven quick actions that run a single request without a dialog. */
const OPERATION = fc.constantFrom(
  'Kiểm tra trạng thái',
  'Dữ liệu 12 giờ',
  'Lấy biến dữ liệu',
  'Đọc mã OTP',
);

function makeAccountService(): AccountService {
  return {
    checkAccount: jest.fn().mockResolvedValue({ success: true, data: { a: 1 } }),
    getAccount12h: jest
      .fn()
      .mockResolvedValue({ success: true, data: [{ event: 'x' }] }),
    getVariables: jest.fn().mockResolvedValue({ success: true, data: { v: 1 } }),
    reinvite: jest.fn().mockResolvedValue({ success: true, message: 'sent' }),
  };
}

function makeOtpService(): OTPService {
  return {
    readOTP: jest.fn().mockResolvedValue({ success: true, otp: '123456' }),
  };
}

function makeMonitorService(): WebSocketService {
  let messageCb: ((m: WSMessage) => void) | null = null;
  let statusCb: ((s: ConnectionStatus) => void) | null = null;
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onMessage: (cb) => {
      messageCb = cb;
    },
    onStatusChange: (cb) => {
      statusCb = cb;
    },
    getStatus: () => 'disconnected',
  };
}

describe('DashboardPage — Property 12: Dashboard email persistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps the email field equal to the entered email across any operation sequence', async () => {
    await fc.assert(      fc.asyncProperty(
        validEmail,
        fc.array(OPERATION, { minLength: 1, maxLength: 6 }),
        async (email, operations) => {
          // Sanity: the generator only produces validator-accepted emails.
          expect(validateEmail(email).isValid).toBe(true);

          render(
            <ThemeProvider>
              <NotificationProvider>
                <DashboardPage
                  accountService={makeAccountService()}
                  otpService={makeOtpService()}
                  createMonitor={makeMonitorService}
                />
              </NotificationProvider>
            </ThemeProvider>,
          );

          const input = screen.getByLabelText(
            'Email address',
          ) as HTMLInputElement;

          // Enter the email once and flush the validation debounce so the
          // quick-action buttons enable.
          fireEvent.change(input, { target: { value: email } });
          act(() => {
            jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
          });

          // Perform each operation in the generated order.
          for (const label of operations) {
            const button = screen.getByRole('button', { name: label });
            // eslint-disable-next-line no-await-in-loop
            await act(async () => {
              fireEvent.click(button);
            });
          }

          // The email field value is unchanged by any operation (Req 12.6).
          expect(input.value).toBe(email);

          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
