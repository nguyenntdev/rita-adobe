import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { Account12hPage, NO_DATA_MESSAGE } from './Account12hPage';
import { NotificationProvider } from '../../context/NotificationContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput';
import * as accountService from '../../services/accountService';

/**
 * Unit tests for Account12hPage (task 14.4).
 *
 * Covers the success-with-data table rendering (headers + every field, Req 3.3),
 * the success-empty "no data" state (Req 3.4), the failure state (Req 3.5), and
 * the action-button enablement invariant (Req 3.1 / 8.4: enabled iff email valid
 * AND not loading).
 *
 * `getAccount12h` is mocked so the page logic is exercised without real network
 * calls. The EmailInput debounce (500ms) is driven with jest fake timers so the
 * reported validity — and thus the button's enabled state — is deterministic.
 */

jest.mock('../../services/accountService');

const getAccount12hMock = accountService.getAccount12h as jest.MockedFunction<
  typeof accountService.getAccount12h
>;

const VALID_EMAIL = 'support@example.com';

function renderPage() {
  return render(
    <NotificationProvider>
      <Account12hPage />
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

function getRetrieveButton() {
  return screen.getByRole('button', { name: /view 12h data/i });
}

describe('Account12hPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getAccount12hMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the email input, retrieval button, and an initial placeholder (Req 3.1)', () => {
    renderPage();

    expect(
      screen.getByRole('textbox', { name: /email address/i }),
    ).toBeInTheDocument();
    expect(getRetrieveButton()).toBeInTheDocument();
    expect(screen.getByTestId('account-12h-placeholder')).toBeInTheDocument();
  });

  it('keeps the retrieve button disabled until a valid email is entered (Req 3.1, 8.4)', () => {
    renderPage();

    // No email yet: disabled.
    expect(getRetrieveButton()).toBeDisabled();

    // Invalid email: still disabled.
    enterEmail('not-an-email');
    expect(getRetrieveButton()).toBeDisabled();

    // Valid email: enabled.
    enterEmail(VALID_EMAIL);
    expect(getRetrieveButton()).toBeEnabled();
  });

  it('renders a table with headers covering every field on success (Req 3.3)', async () => {
    getAccount12hMock.mockResolvedValue({
      success: true,
      data: [
        { event: 'login', status: 'ok' },
        { event: 'logout', region: 'us-east' },
      ],
    });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getRetrieveButton());
    });

    expect(getAccount12hMock).toHaveBeenCalledWith(VALID_EMAIL);

    const table = screen.getByTestId('data-table');
    expect(table).toBeInTheDocument();

    // Headers cover the union of keys across all records (Req 3.3).
    const headers = within(table)
      .getAllByTestId('data-table-header')
      .map((node) => node.textContent);
    expect(headers).toEqual(
      expect.arrayContaining(['event', 'status', 'region']),
    );

    // Every present field value is rendered.
    expect(within(table).getByText('login')).toBeInTheDocument();
    expect(within(table).getByText('logout')).toBeInTheDocument();
    expect(within(table).getByText('us-east')).toBeInTheDocument();
  });

  it('shows the "no data" empty state when the result is empty (Req 3.4)', async () => {
    getAccount12hMock.mockResolvedValue({ success: true, data: [] });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getRetrieveButton());
    });

    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(
      NO_DATA_MESSAGE,
    );
    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
  });

  it('treats a missing data field as an empty result (Req 3.4)', async () => {
    getAccount12hMock.mockResolvedValue({ success: true });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getRetrieveButton());
    });

    expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();
  });

  it('renders the API failure reason on error (Req 3.5)', async () => {
    getAccount12hMock.mockResolvedValue({
      success: false,
      error: 'Account not found',
    });

    renderPage();
    enterEmail(VALID_EMAIL);

    await act(async () => {
      fireEvent.click(getRetrieveButton());
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
  });

  it('does not call the service when the email is invalid', () => {
    renderPage();
    enterEmail('bad-email');

    // The button is disabled, but assert the guard holds even if clicked.
    fireEvent.click(getRetrieveButton());

    expect(getAccount12hMock).not.toHaveBeenCalled();
  });
});
