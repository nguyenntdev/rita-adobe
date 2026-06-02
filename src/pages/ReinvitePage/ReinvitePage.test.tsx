import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReinvitePage } from './ReinvitePage';
import {
  NotificationProvider,
  useNotifications,
  type NotificationContextValue,
} from '../../context/NotificationContext';

/**
 * Unit/component tests for the ReinvitePage (task 15.1).
 *
 * The account service is mocked so the tests can assert the confirmation flow
 * wiring without issuing real requests:
 *   - the confirmation dialog shows the exact entered email (Req 5.2)
 *   - an invalid email suppresses the dialog (Req 5.3)
 *   - confirming calls reinvite and surfaces success/error toasts (Req 5.4-5.6)
 *   - cancelling issues no request and preserves state (Req 5.7)
 */

jest.mock('../../services/accountService', () => ({
  reinvite: jest.fn(),
}));

import { reinvite } from '../../services/accountService';

const mockReinvite = reinvite as jest.Mock;

// Captures the live notification context so tests can read emitted toasts.
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

async function typeEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  const input = screen.getByRole('textbox', { name: /email address/i });
  await user.click(input);
  await user.paste(email);
  // Flush the EmailInput validation debounce so onValidationChange fires.
  act(() => {
    jest.advanceTimersByTime(500);
  });
  return input;
}

describe('ReinvitePage', () => {
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

  it('disables the reinvite button until a valid email is entered', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    const button = screen.getByRole('button', { name: /reinvite/i });
    expect(button).toBeDisabled();

    await typeEmail(user, 'user@example.com');

    expect(button).toBeEnabled();
  });

  it('opens a confirmation dialog containing exactly the entered email (Req 5.2)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await typeEmail(user, 'reinvite.target@example.com');
    await user.click(screen.getByRole('button', { name: /reinvite/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('reinvite.target@example.com');
    expect(mockReinvite).not.toHaveBeenCalled();
  });

  it('calls reinvite and shows a success toast on confirm (Req 5.4, 5.5)', async () => {
    mockReinvite.mockResolvedValue({
      success: true,
      message: 'Invitation queued.',
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await typeEmail(user, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /reinvite/i }));
    await user.click(screen.getByRole('button', { name: /send reinvite/i }));

    // The success toast is emitted after the reinvite promise resolves, so wait
    // for the notification to surface rather than just the mock call.
    await waitFor(() =>
      expect(notifications?.notifications).toHaveLength(1),
    );

    expect(mockReinvite).toHaveBeenCalledWith('user@example.com');
    expect(notifications?.notifications[0]).toMatchObject({
      type: 'success',
      message: 'Invitation queued.',
    });
    // Dialog closes after confirming.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an error toast with the API failure reason on failure (Req 5.6)', async () => {
    mockReinvite.mockResolvedValue({
      success: false,
      error: 'email already invited',
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await typeEmail(user, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /reinvite/i }));
    await user.click(screen.getByRole('button', { name: /send reinvite/i }));

    await waitFor(() =>
      expect(notifications?.notifications).toHaveLength(1),
    );

    expect(mockReinvite).toHaveBeenCalledTimes(1);
    expect(notifications?.notifications[0]).toMatchObject({
      type: 'error',
      message: 'email already invited',
    });
  });

  it('cancelling issues no request and preserves the email value (Req 5.7)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    const input = await typeEmail(user, 'user@example.com');
    await user.click(screen.getByRole('button', { name: /reinvite/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockReinvite).not.toHaveBeenCalled();
    // State preserved: the email value is unchanged and no toast was emitted.
    expect(input).toHaveValue('user@example.com');
    expect(notifications?.notifications).toHaveLength(0);
  });

  it('does not open the dialog when the email is invalid (Req 5.3)', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPage();

    await typeEmail(user, 'not-an-email');

    const button = screen.getByRole('button', { name: /reinvite/i });
    // The button is disabled for an invalid email, so a click cannot open the
    // dialog (Req 5.3 / Req 8.4).
    expect(button).toBeDisabled();
    await user.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockReinvite).not.toHaveBeenCalled();
  });
});
