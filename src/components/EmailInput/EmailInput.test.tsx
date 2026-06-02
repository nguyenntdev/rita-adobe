import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  EmailInput,
  EMAIL_VALIDATION_DEBOUNCE_MS,
  type EmailInputProps,
} from './EmailInput';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_INVALID_FORMAT_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
} from '../../utils/emailValidation';

/**
 * Unit tests for the EmailInput component (task 10.1).
 *
 * Covers controlled-input behaviour, validity reporting via onValidationChange
 * (Req 8.1/8.4), debounced invalid-format feedback (Req 8.2), the required
 * message on blur (Req 8.6), and the 254-character maximum (Req 8.5).
 */

/**
 * Wrapper that owns the email value so the controlled component can be driven
 * the way a real parent page would use it.
 */
function ControlledEmailInput(
  props: Omit<EmailInputProps, 'value' | 'onChange'> & { initialValue?: string },
) {
  const { initialValue = '', ...rest } = props;
  const [value, setValue] = useState(initialValue);
  return <EmailInput value={value} onChange={setValue} {...rest} />;
}

describe('EmailInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders an accessible email input that reflects the controlled value', () => {
    const onValidationChange = jest.fn();
    render(
      <EmailInput
        value="user@example.com"
        onChange={jest.fn()}
        onValidationChange={onValidationChange}
        placeholder="Enter email"
      />,
    );

    const input = screen.getByRole('textbox', { name: /email address/i });
    expect(input).toHaveValue('user@example.com');
    expect(input).toHaveAttribute('placeholder', 'Enter email');
  });

  it('propagates edits to onChange', () => {
    const onChange = jest.fn();
    render(
      <EmailInput
        value=""
        onChange={onChange}
        onValidationChange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), {
      target: { value: 'a@b.co' },
    });

    expect(onChange).toHaveBeenCalledWith('a@b.co');
  });

  it('reports validity changes through onValidationChange after the debounce', () => {
    const onValidationChange = jest.fn();
    render(
      <ControlledEmailInput
        initialValue="user@example.com"
        onValidationChange={onValidationChange}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
    });

    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the invalid-format message within the 500ms debounce window', () => {
    render(<ControlledEmailInput onValidationChange={jest.fn()} />);

    const input = screen.getByRole('textbox', { name: /email address/i });
    act(() => {
      fireEvent.change(input, { target: { value: 'not-an-email' } });
    });

    // Just before the debounce elapses, no error is shown yet.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS - 1);
    });
    expect(screen.queryByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeNull();

    // At the debounce boundary the error appears.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeInTheDocument();
  });

  it('does not nag with the required message while typing, but shows it on blur', () => {
    const onValidationChange = jest.fn();
    render(<ControlledEmailInput onValidationChange={onValidationChange} />);

    const input = screen.getByRole('textbox', { name: /email address/i });

    // Empty value while untouched: invalid, but no visible required message.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
    });
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText(EMAIL_REQUIRED_MESSAGE)).toBeNull();

    // On blur the required message is surfaced.
    act(() => {
      fireEvent.blur(input);
    });
    expect(screen.getByText(EMAIL_REQUIRED_MESSAGE)).toBeInTheDocument();
  });

  it('enforces the 254-character maximum at the input boundary', () => {
    const onChange = jest.fn();
    render(
      <EmailInput value="" onChange={onChange} onValidationChange={jest.fn()} />,
    );

    const input = screen.getByRole('textbox', { name: /email address/i });
    expect(input).toHaveAttribute('maxlength', String(EMAIL_MAX_LENGTH));

    const overLength = 'a'.repeat(EMAIL_MAX_LENGTH + 10);
    fireEvent.change(input, { target: { value: overLength } });

    expect(onChange).toHaveBeenCalledWith('a'.repeat(EMAIL_MAX_LENGTH));
  });

  it('disables the input when disabled is set', () => {
    render(
      <EmailInput
        value=""
        onChange={jest.fn()}
        onValidationChange={jest.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('textbox', { name: /email address/i })).toBeDisabled();
  });
});

/**
 * Validation timing tests (task 10.2, Requirement 8.2).
 *
 * These tests use jest fake timers to assert that, after an input change, the
 * invalid-format validation error becomes visible within the 500ms debounce
 * window and never before it. They also verify the debounce resets on rapid
 * successive edits so the error stays anchored to the most recent change.
 */
describe('EmailInput validation timing (Req 8.2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const typeInvalid = () => {
    const input = screen.getByRole('textbox', { name: /email address/i });
    act(() => {
      fireEvent.change(input, { target: { value: 'invalid-email' } });
    });
    return input;
  };

  it('does not surface the validation error before the debounce window elapses', () => {
    render(<ControlledEmailInput onValidationChange={jest.fn()} />);
    typeInvalid();

    // The entire window minus 1ms has passed: still no error.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS - 1);
    });

    expect(screen.queryByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces the validation error within the 500ms window of the input change', () => {
    render(<ControlledEmailInput onValidationChange={jest.fn()} />);
    typeInvalid();

    // Advancing exactly to the debounce bound flushes the validation feedback.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
    });

    expect(EMAIL_VALIDATION_DEBOUNCE_MS).toBeLessThanOrEqual(500);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(EMAIL_INVALID_FORMAT_MESSAGE);
  });

  it('resets the debounce timer on each successive edit so the error tracks the latest change', () => {
    render(<ControlledEmailInput onValidationChange={jest.fn()} />);
    const input = screen.getByRole('textbox', { name: /email address/i });

    act(() => {
      fireEvent.change(input, { target: { value: 'first' } });
    });

    // Wait almost the full window, then edit again before it elapses.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS - 1);
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'second' } });
    });

    // The original timer would have fired 1ms after the second edit; confirm
    // the reset prevented an early error.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeNull();

    // A full window after the most recent edit, the error appears.
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS - 1);
    });
    expect(screen.getByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeInTheDocument();
  });

  it('clears the validation error within the debounce window once the email becomes valid', () => {
    render(<ControlledEmailInput onValidationChange={jest.fn()} />);
    const input = typeInvalid();

    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
    });
    expect(screen.getByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeInTheDocument();

    // Correct the value; the error must clear within the same 500ms window.
    act(() => {
      fireEvent.change(input, { target: { value: 'user@example.com' } });
    });
    act(() => {
      jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
    });

    expect(screen.queryByText(EMAIL_INVALID_FORMAT_MESSAGE)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
