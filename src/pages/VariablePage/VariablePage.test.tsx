import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VariablePage } from './VariablePage';
import { NotificationProvider } from '../../context/NotificationContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput';
import * as accountService from '../../services/accountService';

/**
 * Unit tests for VariablePage (task 14.5).
 *
 * Covers the success-with-data (Req 4.3), success-empty (Req 4.4), and failure
 * (Req 4.5) states, plus the action-button enablement invariant (Req 8.4:
 * enabled iff email valid AND not loading).
 *
 * `getVariables` is mocked so the page logic is exercised without real network
 * calls. The EmailInput debounce (500ms) is driven with jest fake timers so the
 * reported validity — and thus the button's enabled state — is deterministic.
 */

jest.mock('../../services/accountService');

const getVariablesMock = accountService.getVariables as jest.MockedFunction<
  typeof accountService.getVariables
>;

const VALID_EMAIL = 'user@example.com';

function renderPage() {
  return render(
    <NotificationProvider>
      <VariablePage />
    </NotificationProvider>,
  );
}

/** Type a value into the email field and flush the validation debounce. */
function enterEmail(value: string) {
  const input = screen.getByRole('textbox', { name: /email address/i });
  act(() => {
    fireEvent.change(input, { target: { value } });
  });
  act(() => {
    jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
  });
  return input;
}

function getFetchButton() {
  return screen.getByRole('button', { name: /fetch variables/i });
}

describe('VariablePage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getVariablesMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the email input, fetch button, and an initial placeholder', () => {
    renderPage();

    expect(
      screen.getByRole('textbox', { name: /email address/i }),
    ).toBeInTheDocument();
    expect(getFetchButton()).toBeInTheDocument();
    expect(screen.getByTestId('variable-placeholder')).toBeInTheDocument();
  });

  it('keeps the fetch button disabled until a valid email is entered (Req 8.4)', () => {
    renderPage();

    // No email yet: disabled.
    expect(getFetchButton()).toBeDisabled();

    // Invalid email: still disabled.
    enterEmail('not-an-email');
    expect(getFetchButton()).toBeDisabled();

    // Valid email: enabled.
    enterEmail(VALID_EMAIL);
    expect(getFetchButton()).toBeEnabled();
  });

  it('displays variable data in key-value format on success (Req 4.3)', async () => {
    getVariablesMock.mockResolvedValue({
      success: true,
      data: { plan: 'pro', seats: 5, active: true },
    });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getFetchButton());
    });

    expect(getVariablesMock).toHaveBeenCalledWith(VALID_EMAIL);

    const display = screen.getByTestId('key-value-display');
    expect(display).toBeInTheDocument();

    const keys = screen
      .getAllByTestId('key-value-key')
      .map((n) => n.textContent);
    expect(keys).toEqual(['plan', 'seats', 'active']);

    const values = screen
      .getAllByTestId('key-value-value')
      .map((n) => n.textContent);
    expect(values).toEqual(['pro', '5', 'true']);
  });

  it('shows a no-data message when the result is empty (Req 4.4)', async () => {
    getVariablesMock.mockResolvedValue({ success: true, data: {} });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getFetchButton());
    });

    expect(screen.getByTestId('key-value-empty')).toHaveTextContent(
      /no variable data is available/i,
    );
  });

  it('treats a missing data field as an empty result (Req 4.4)', async () => {
    getVariablesMock.mockResolvedValue({ success: true });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getFetchButton());
    });

    expect(screen.getByTestId('key-value-empty')).toBeInTheDocument();
  });

  it('displays the failure reason returned by the endpoint on error (Req 4.5)', async () => {
    getVariablesMock.mockResolvedValue({
      success: false,
      error: 'Upstream variable service unavailable',
    });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getFetchButton());
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Upstream variable service unavailable',
    );
    // No key-value output is rendered on failure.
    expect(screen.queryByTestId('key-value-display')).not.toBeInTheDocument();
  });

  it('does not call the service when the email is invalid', () => {
    renderPage();
    enterEmail('bad-email');

    // The button is disabled, but assert the guard holds even if clicked.
    fireEvent.click(getFetchButton());

    expect(getVariablesMock).not.toHaveBeenCalled();
  });
});
