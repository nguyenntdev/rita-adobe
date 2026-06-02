import { useState, type CSSProperties } from 'react';

import { EmailInput } from '../../components/EmailInput';
import { ActionButton } from '../../components/ActionButton';
import { ResultPanel } from '../../components/ResultPanel';
import { useNotifications } from '../../context/NotificationContext';
import { otpService } from '../../services/otpService';

import './OTPPage.css';

/**
 * OTP Reading page (design "OTPPage", task 14.6).
 *
 * Lets support staff read the one-time password for an account and copy it to
 * the clipboard. Wiring:
 *   - {@link EmailInput} captures and validates the target email
 *     (Requirements 6.1, 8.x). Its validity gates the read button.
 *   - {@link ActionButton} triggers {@link otpService.readOTP}; it is disabled
 *     while the email is invalid or a request is in flight.
 *   - {@link ResultPanel} hosts the loading state and the retrieved-OTP /
 *     no-OTP body.
 *   - {@link useNotifications} surfaces success/error toasts.
 *
 * Behaviour mapped to acceptance criteria:
 *   - 6.3: the OTP value renders at >= 18px with a high-contrast colour.
 *   - 6.4: a successful request with no OTP shows a "no OTP found" message.
 *   - 6.5: a failed request shows an error toast with the API failure reason.
 *   - 6.6: a copy-to-clipboard button sits adjacent to the OTP value.
 *   - 6.7: a successful copy shows a success toast (auto-dismissed after 3s by
 *     the NotificationContext).
 *   - 6.8: a failed copy shows an error indicating the clipboard operation was
 *     unsuccessful.
 */

/**
 * Minimum font size (px) the OTP value must be displayed at (Requirement 6.3).
 */
export const OTP_MIN_FONT_SIZE_PX = 18;

/** Message shown when the request succeeds but no OTP is available (Req 6.4). */
export const NO_OTP_MESSAGE = 'No OTP was found for this email.';

/** Error shown when copying the OTP to the clipboard fails (Req 6.8). */
export const COPY_FAILURE_MESSAGE =
  'Failed to copy the OTP to the clipboard. Please copy it manually.';

/** Success toast shown after the OTP is copied (Req 6.7). */
export const COPY_SUCCESS_MESSAGE = 'OTP copied to clipboard.';

/**
 * High-contrast, >= 18px presentation for the OTP value (Requirement 6.3).
 * Applied inline so the contrast/size guarantee holds regardless of external
 * stylesheet loading (and is assertable in tests where CSS is mocked).
 */
const otpValueStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  fontFamily: 'monospace',
  color: '#0b1f33',
  background: '#ffffff',
};

/**
 * Attempt to copy `text` to the clipboard, returning whether it succeeded.
 * Treats a missing Clipboard API or a rejected write as failure (Req 6.8).
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function OTPPage() {
  const { showSuccess, showError } = useNotifications();

  const [email, setEmail] = useState('');
  const [emailValid, setEmailValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string | undefined>(undefined);
  const [noOtp, setNoOtp] = useState(false);

  const handleRead = async () => {
    setLoading(true);
    // Clear any previous result so a new read starts from a clean slate.
    setOtp(undefined);
    setNoOtp(false);

    const result = await otpService.readOTP(email);

    if (result.success) {
      if (result.otp !== undefined) {
        // OTP retrieved (Requirement 6.3).
        setOtp(result.otp);
      } else {
        // Successful request but no OTP available (Requirement 6.4).
        setNoOtp(true);
      }
    } else {
      // Failed request: surface the API failure reason as an error toast
      // (Requirement 6.5).
      showError(result.error ?? 'Failed to read OTP.');
    }

    setLoading(false);
  };

  const handleCopy = async () => {
    if (otp === undefined) {
      return;
    }
    const copied = await copyToClipboard(otp);
    if (copied) {
      // Success toast auto-dismisses after 3s via NotificationContext (Req 6.7).
      showSuccess(COPY_SUCCESS_MESSAGE);
    } else {
      // Clipboard operation failed (Requirement 6.8).
      showError(COPY_FAILURE_MESSAGE);
    }
  };

  return (
    <div className="otp-page">
      <h1 className="otp-page__heading">Read OTP</h1>

      <div className="otp-page__controls">
        <EmailInput
          value={email}
          onChange={setEmail}
          onValidationChange={setEmailValid}
          disabled={loading}
          placeholder="Account email"
        />
        <ActionButton
          label="Read OTP"
          onClick={handleRead}
          loading={loading}
          disabled={!emailValid}
        />
      </div>

      <ResultPanel title="OTP" loading={loading}>
        {otp !== undefined ? (
          <div className="otp-page__result">
            <span
              className="otp-page__value"
              style={otpValueStyle}
              data-testid="otp-value"
            >
              {otp}
            </span>
            <ActionButton
              label="Copy"
              onClick={handleCopy}
              variant="secondary"
            />
          </div>
        ) : noOtp ? (
          <p className="otp-page__empty" data-testid="otp-empty">
            {NO_OTP_MESSAGE}
          </p>
        ) : (
          <p className="otp-page__placeholder">
            Enter an email and select Read OTP to retrieve the one-time password.
          </p>
        )}
      </ResultPanel>
    </div>
  );
}

export default OTPPage;
