import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import fc from 'fast-check';

import { NotificationProvider } from '../../context/NotificationContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput/EmailInput';
import type { AccountService, OTPService, WebSocketService, WSMessage, ConnectionStatus } from '../../types';
import { DashboardPage } from './DashboardPage';

/**
 * Feature: rita-adobe, Property 13: Dashboard panel result replacement
 *
 * For any dashboard panel and any non-empty sequence of operation results
 * routed to that panel, the panel content SHALL equal the most recent result
 * only, with no remnants of previous results.
 *
 * Validates: Requirements 12.5
 *
 * Strategy: drive the Variables panel (backed by `getVariables`, rendered with
 * the generic FieldList) with a non-empty sequence of distinct key/value
 * records. After running the whole sequence, the panel must show exactly the
 * final result's value and none of the values unique to earlier results.
 */

const VALID_EMAIL = 'user@example.com';

/**
 * Distinct single key/value records. Built from a small alphabet without
 * `.filter` so generation is cheap (filtered string arbitraries are slow and
 * can starve the runner). A `salt` integer keeps keys/values identifiable.
 */
const tokenArb = fc
  .tuple(
    fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
    fc.integer({ min: 0, max: 9999 }),
  )
  .map(([chars, salt]) => `${chars.join('')}${salt}`);

const recordArb = fc
  .tuple(tokenArb, tokenArb)
  .map(([key, value]) => ({ [`k_${key}`]: `v_${value}` }));

function makeMonitorService(): WebSocketService {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onMessage: (_cb: (m: WSMessage) => void) => {},
    onStatusChange: (_cb: (s: ConnectionStatus) => void) => {},
    getStatus: () => 'disconnected',
  };
}

function makeOtpService(): OTPService {
  return { readOTP: jest.fn().mockResolvedValue({ success: true, otp: '000000' }) };
}

describe('DashboardPage — Property 13: Dashboard panel result replacement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows only the most recent result in a panel after a sequence of results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(recordArb, { minLength: 1, maxLength: 6 }),
        async (results) => {
          // getVariables resolves the next result on each successive call.
          const getVariables = jest.fn();
          results.forEach((data) =>
            getVariables.mockResolvedValueOnce({ success: true, data }),
          );
          const accountService: AccountService = {
            checkAccount: jest
              .fn()
              .mockResolvedValue({ success: true, data: {} }),
            getAccount12h: jest.fn().mockResolvedValue({ success: true, data: [] }),
            getVariables,
            reinvite: jest.fn().mockResolvedValue({ success: true, message: 'sent' }),
          };

          render(
            <ThemeProvider>
              <NotificationProvider>
                <DashboardPage
                  accountService={accountService}
                  otpService={makeOtpService()}
                  createMonitor={makeMonitorService}
                />
              </NotificationProvider>
            </ThemeProvider>,
          );

          const input = screen.getByLabelText('Email address') as HTMLInputElement;
          fireEvent.change(input, { target: { value: VALID_EMAIL } });
          // Flush the EmailInput debounce so the tools menu enables.
          act(() => {
            jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
          });

          // Run "Lấy biến dữ liệu" from the tools dropdown for each result.
          for (let i = 0; i < results.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await act(async () => {
              fireEvent.click(
                screen.getByRole('button', { name: 'Công cụ khác' }),
              );
            });
            // eslint-disable-next-line no-await-in-loop
            await act(async () => {
              fireEvent.click(screen.getByTestId('tool-variables'));
            });
          }

          // After the full sequence, only the final result remains. The values
          // (v_<token>) are rendered verbatim by FieldList and uniquely
          // identify each result; earlier values must be gone (Req 12.5).
          const panel = screen.getByRole('region', {
            name: 'Biến dữ liệu',
          });
          const finalValue = Object.values(results[results.length - 1])[0];

          expect(within(panel).queryByText(finalValue)).not.toBeNull();

          for (let i = 0; i < results.length - 1; i += 1) {
            const value = Object.values(results[i])[0];
            if (value !== finalValue) {
              expect(within(panel).queryByText(value)).toBeNull();
            }
          }

          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  }, 120000);
});
