import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  validateEmail,
  EMAIL_MAX_LENGTH,
} from '../../utils/emailValidation';
import './EmailInput.css';

/**
 * Reusable validated email input (design "EmailInput", task 10.1).
 *
 * Behaviour (Requirements 8.1, 8.2, 8.4, 8.6 and the design error-handling table):
 *   - Controlled component: the parent owns `value` and receives changes via
 *     `onChange`.
 *   - Validation runs through {@link validateEmail}. Validity is reported to the
 *     parent via `onValidationChange` so it can enable/disable the associated
 *     action buttons (Requirement 8.4).
 *   - Invalid-format feedback is debounced so the visible error message appears
 *     within {@link EMAIL_VALIDATION_DEBOUNCE_MS} of the input change
 *     (Requirement 8.2), avoiding error flicker while the user is still typing.
 *   - The "email is required" message is surfaced on blur rather than while the
 *     user is typing, matching the design error table ("On blur or submit").
 *   - The 254-character maximum is enforced at the input boundary so an
 *     over-length value can never be entered (Requirement 8.5 / task 10.1).
 */

/**
 * Debounce window (ms) for surfacing the invalid-format validation message.
 * Kept at the 500ms upper bound mandated by Requirement 8.2.
 */
export const EMAIL_VALIDATION_DEBOUNCE_MS = 500;

export interface EmailInputProps {
  /** Current email value (the parent owns this state). */
  value: string;
  /** Called with the next value whenever the user edits the field. */
  onChange: (value: string) => void;
  /** Called whenever the computed validity of `value` changes. */
  onValidationChange: (isValid: boolean) => void;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Placeholder text shown when the field is empty. */
  placeholder?: string;
}

export function EmailInput({
  value,
  onChange,
  onValidationChange,
  disabled,
  placeholder,
}: EmailInputProps) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const errorId = useId();

  // Keep the latest callback in a ref so the debounce effect does not need to
  // re-run (and reset its timer) when the parent passes a new function identity.
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  // Shared validation routine. `showRequired` controls whether the
  // "email is required" message is surfaced for an empty value.
  const evaluate = (current: string, showRequired: boolean) => {
    const result = validateEmail(current);
    onValidationChangeRef.current(result.isValid);

    const isEmpty = current.trim().length === 0;
    if (isEmpty && !showRequired) {
      // Don't nag with the required message while the user is still typing.
      setError(undefined);
    } else {
      setError(result.isValid ? undefined : result.error);
    }
  };

  // Debounce validation feedback so the invalid-format error appears within the
  // 500ms window after the input changes (Requirement 8.2).
  useEffect(() => {
    const timer = setTimeout(() => {
      evaluate(value, touched);
    }, EMAIL_VALIDATION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `evaluate` is intentionally omitted: it is recreated each render but only
    // reads `value`/`touched` (deps) and the stable callback ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, touched]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Enforce the 254-character maximum at the boundary so an over-length value
    // is never propagated to the parent (task 10.1, Requirement 8.5).
    const next = event.target.value.slice(0, EMAIL_MAX_LENGTH);
    onChange(next);
  };

  const handleBlur = () => {
    setTouched(true);
    // Surface validation (including the required message) immediately on blur.
    evaluate(value, true);
  };

  return (
    <div className="email-input">
      <input
        type="email"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={EMAIL_MAX_LENGTH}
        aria-label="Email address"
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {error !== undefined && (
        <span id={errorId} role="alert" className="email-input__error">
          {error}
        </span>
      )}
    </div>
  );
}

export default EmailInput;
