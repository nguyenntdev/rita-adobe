import { act, cleanup, render, screen } from '@testing-library/react';
import fc from 'fast-check';
import {
  NotificationProvider,
  SUCCESS_AUTO_DISMISS_MS,
  useNotifications,
  type NotificationContextValue,
} from './NotificationContext';

/**
 * Property 11: Notification stacking order.
 *
 * Feature: rita-adobe, Property 11: Notification stacking order
 *
 * For any sequence of notifications added to the notification stack, the
 * rendered list SHALL order them most-recent-first, with the most recently
 * added notification appearing at the top.
 *
 * **Validates: Requirements 10.7**
 */

// Captures the live context value so the test can drive notification additions.
let api: NotificationContextValue | null = null;

function CaptureApi() {
  api = useNotifications();
  return null;
}

// Renders the notifications in context order (index 0 = top of the stack).
function NotificationList() {
  const { notifications } = useNotifications();
  return (
    <ul>
      {notifications.map((n) => (
        <li key={n.id} data-testid="notification-item" data-type={n.type}>
          {n.message}
        </li>
      ))}
    </ul>
  );
}

type AddedNotification = { type: 'success' | 'error' | 'info'; message: string };

function addNotification(
  context: NotificationContextValue,
  { type, message }: AddedNotification,
): void {
  switch (type) {
    case 'success':
      context.showSuccess(message);
      break;
    case 'error':
      context.showError(message);
      break;
    case 'info':
      context.showInfo(message);
      break;
  }
}

describe('NotificationContext - Property 11: Notification stacking order', () => {
  beforeEach(() => {
    // Freeze timers so the 3s success auto-dismiss never fires mid-assertion,
    // isolating the ordering behaviour under test.
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    api = null;
  });

  it('renders notifications most-recent-first for any addition sequence', () => {
    const notificationArb = fc.record<AddedNotification>({
      type: fc.constantFrom('success', 'error', 'info'),
      message: fc.string(),
    });

    fc.assert(
      fc.property(
        fc.array(notificationArb, { minLength: 0, maxLength: 30 }),
        (sequence) => {
          api = null;
          const { unmount } = render(
            <NotificationProvider>
              <CaptureApi />
              <NotificationList />
            </NotificationProvider>,
          );

          try {
            // Add notifications in the generated order.
            act(() => {
              for (const item of sequence) {
                addNotification(api as NotificationContextValue, item);
              }
            });

            const renderedItems = screen.queryAllByTestId('notification-item');

            // The rendered stack must be the addition order reversed
            // (most-recent-first).
            const expected = [...sequence].reverse();

            expect(renderedItems).toHaveLength(expected.length);
            renderedItems.forEach((node, index) => {
              expect(node.getAttribute('data-type')).toBe(expected[index].type);
              expect(node.textContent).toBe(expected[index].message);
            });
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Unit tests for success-toast auto-dismiss timing (Task 9.4).
 *
 * Requirement 10.5: success notifications are automatically dismissed after
 * 3 seconds. These tests drive the behaviour with jest fake timers so the
 * exact 3s boundary can be asserted deterministically.
 */
describe('NotificationContext - success auto-dismiss timing (Requirement 10.5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    api = null;
  });

  it('auto-dismisses a success notification after exactly 3 seconds', () => {
    render(
      <NotificationProvider>
        <CaptureApi />
        <NotificationList />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showSuccess('Saved!');
    });

    // Visible immediately after creation.
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);

    // Just before the 3s boundary it must still be visible.
    act(() => {
      jest.advanceTimersByTime(SUCCESS_AUTO_DISMISS_MS - 1);
    });
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);

    // At the 3s boundary the success toast auto-dismisses.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryAllByTestId('notification-item')).toHaveLength(0);
  });

  it('does NOT auto-dismiss error or info notifications after 3 seconds', () => {
    render(
      <NotificationProvider>
        <CaptureApi />
        <NotificationList />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showError('Boom');
      (api as NotificationContextValue).showInfo('FYI');
    });

    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);

    // Advance well past the success auto-dismiss window.
    act(() => {
      jest.advanceTimersByTime(SUCCESS_AUTO_DISMISS_MS * 2);
    });

    // Error and info notifications persist (only success auto-dismisses).
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
  });

  it('only auto-dismisses the success toast, leaving the error toast visible', () => {
    render(
      <NotificationProvider>
        <CaptureApi />
        <NotificationList />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showError('Persistent error');
      (api as NotificationContextValue).showSuccess('Transient success');
    });

    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(SUCCESS_AUTO_DISMISS_MS);
    });

    const remaining = screen.getAllByTestId('notification-item');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].getAttribute('data-type')).toBe('error');
    expect(remaining[0].textContent).toBe('Persistent error');
  });
});
