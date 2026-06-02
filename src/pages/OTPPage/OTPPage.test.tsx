import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  OTPPage,
  NO_OTP_MESSAGE,
  COPY_FAILURE_MESSAGE,
  COPY_SUCCESS_MESSAGE,
  OTP_MIN_FONT_SIZE_PX,
} from './OTPPage';
import { NotificationProvider } from '../../context/NotificationContext';
import { ToastContainer } from '../../components/ToastNotification';
import { otpService } from '../../services/otpService';

/**
 * Unit tests for the OTPPage (task 14.6 / tested under 14.7).
 *
 * Covers OTP display with >= 18px high-contrast font (Req 6.3), the no-OTP
 * message (Req 6.4), the API-error toast (Req 6.5), the adjacent copy button
 * (Req 6.6), the copy success toast (Req 6.7), and the copy failure error
 * (Req 6.8).
 */

jest.mock('../../services/otpService', () => ({
  otpService: { readOTP: jest.fn() },
}));

const mockedReadOTP = otpService.readOTP as jest.Mock;

function renderPage() {
  return render(
    <NotificationProvider>
      <OTPPage />
      <ToastContainer />
    </NotificationProvider>,
  );
}

/** Enter a valid email and trigger the Read OTP action. */
async function readWithValidEmail(email = 'user@example.com') {
  const input = screen.getByRole('textbox', { name: /email address/i });
  fireEvent.change(input, { target: { value: email } });
  // Allow the EmailInput debounce to flush so the read button enables.
  fireEvent.blur(input);

  const readButton = await screen.findByRole('button', { name: /read otp/i });
  await waitFor(() => expect(readButton).toBeEnabled());

  await act(async () => {
    fireEvent.click(readButton);
  });
}

describe('OTPPage', () => {
  afterEach(() => {
    cleanup();
    mockedReadOTP.mockReset();
    jest.restoreAllMocks();
  });

  it('disables the Read OTP button until a valid email is entered', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /read otp/i })).toBeDisabled();
  });

  it('displays the retrieved OTP at >= 18px high-contrast font (Req 6.3)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true, otp: '123456' });
    renderPage();

    await readWithValidEmail();

    const value = await screen.findByTestId('otp-value');
    expect(value).toHaveTextContent('123456');

    // Font size must be at least 18px (Requirement 6.3).
    const fontSizePx = parseFloat(value.style.fontSize);
    expect(fontSizePx).toBeGreaterThanOrEqual(OTP_MIN_FONT_SIZE_PX);

    // A dark value colour on a light background provides high contrast.
    expect(value.style.color).not.toBe('');
    expect(value.style.background).not.toBe('');
  });

  it('renders a copy button adjacent to the OTP value (Req 6.6)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true, otp: '654321' });
    renderPage();

    await readWithValidEmail();

    expect(await screen.findByTestId('otp-value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('shows the no-OTP message when the request returns no OTP (Req 6.4)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true });
    renderPage();

    await readWithValidEmail();

    expect(await screen.findByTestId('otp-empty')).toHaveTextContent(
      NO_OTP_MESSAGE,
    );
    expect(screen.queryByTestId('otp-value')).toBeNull();
  });

  it('shows an error toast with the API failure reason on failure (Req 6.5)', async () => {
    mockedReadOTP.mockResolvedValue({
      success: false,
      error: 'mailbox unavailable',
    });
    renderPage();

    await readWithValidEmail();

    expect(await screen.findByText('mailbox unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('otp-value')).toBeNull();
  });

  it('copies the OTP and shows a success toast (Req 6.7)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true, otp: '246810' });
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();
    await readWithValidEmail();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    });

    expect(writeText).toHaveBeenCalledWith('246810');
    expect(await screen.findByText(COPY_SUCCESS_MESSAGE)).toBeInTheDocument();
  });

  it('shows an error when the clipboard copy fails (Req 6.8)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true, otp: '111222' });
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderPage();
    await readWithValidEmail();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    });

    expect(await screen.findByText(COPY_FAILURE_MESSAGE)).toBeInTheDocument();
  });

  it('shows a copy error when the Clipboard API is unavailable (Req 6.8)', async () => {
    mockedReadOTP.mockResolvedValue({ success: true, otp: '333444' });
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    renderPage();
    await readWithValidEmail();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    });

    expect(await screen.findByText(COPY_FAILURE_MESSAGE)).toBeInTheDocument();
  });
});
