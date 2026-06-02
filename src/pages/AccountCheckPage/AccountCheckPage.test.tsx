import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccountCheckPage } from './AccountCheckPage';
import { NotificationProvider } from '../../context/NotificationContext';
import { ERROR_MESSAGES } from '../../infrastructure/httpClient';

/**
 * Component tests for AccountCheckPage (task 14.3).
 *
 * The account service is mocked so the tests drive the page's success,
 * failure, and timeout-with-retry behaviours without real network calls.
 *
 * Requirements: 2.1, 2.3, 2.4, 2.6
 */
jest.mock('../../services/accountService', () => ({
  checkAccount: jest.fn(),
}));

import { checkAccount } from '../../services/accountService';

const mockCheckAccount = checkAccount as jest.Mock;

function renderPage() {
  return render(
    <NotificationProvider>
      <AccountCheckPage />
    </NotificationProvider>,
  );
}

const VALID_EMAIL = 'user@example.com';

/** Type a valid email so the action button becomes enabled. */
async function enterValidEmail(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Email address');
  await user.clear(input);
  await user.type(input, VALID_EMAIL);
  // Validity is reported after the EmailInput debounce window elapses.
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Check Status' }),
    ).toBeEnabled();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AccountCheckPage', () => {
  it('renders the email input field for account lookup (Req 2.1)', () => {
    renderPage();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('disables the Check Status button until the email is valid (Req 8.4)', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole('button', { name: 'Check Status' }),
    ).toBeDisabled();

    await enterValidEmail(user);

    expect(
      screen.getByRole('button', { name: 'Check Status' }),
    ).toBeEnabled();
  });

  it('displays every returned field in key-value format on success (Req 2.3)', async () => {
    const user = userEvent.setup();
    mockCheckAccount.mockResolvedValue({
      success: true,
      data: { email: VALID_EMAIL, status: 'active', plan: 'pro' },
    });

    renderPage();
    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Check Status' }));

    await waitFor(() => {
      expect(screen.getByTestId('key-value-display')).toBeInTheDocument();
    });

    expect(mockCheckAccount).toHaveBeenCalledWith(VALID_EMAIL);

    const keys = screen
      .getAllByTestId('key-value-key')
      .map((node) => node.textContent);
    expect(keys).toEqual(['email', 'status', 'plan']);

    const values = screen
      .getAllByTestId('key-value-value')
      .map((node) => node.textContent);
    expect(values).toContain('active');
    expect(values).toContain('pro');
  });

  it('displays the API failure reason on error (Req 2.4)', async () => {
    const user = userEvent.setup();
    mockCheckAccount.mockResolvedValue({
      success: false,
      error: 'Account is locked',
    });

    renderPage();
    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Check Status' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Account is locked');
    });
  });

  it('shows a timeout message and a Retry control on timeout (Req 2.6)', async () => {
    const user = userEvent.setup();
    mockCheckAccount.mockResolvedValue({
      success: false,
      error: ERROR_MESSAGES.timeout,
    });

    renderPage();
    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Check Status' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Retry' }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      ERROR_MESSAGES.timeout,
    );
  });

  it('re-issues the request when Retry is clicked and clears the error on success (Req 2.6)', async () => {
    const user = userEvent.setup();
    mockCheckAccount
      .mockResolvedValueOnce({ success: false, error: ERROR_MESSAGES.timeout })
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'active' },
      });

    renderPage();
    await enterValidEmail(user);
    await user.click(screen.getByRole('button', { name: 'Check Status' }));

    const retry = await screen.findByRole('button', { name: 'Retry' });
    await user.click(retry);

    await waitFor(() => {
      expect(screen.getByTestId('key-value-display')).toBeInTheDocument();
    });

    expect(mockCheckAccount).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
