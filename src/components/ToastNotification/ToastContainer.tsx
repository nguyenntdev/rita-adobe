import { useNotifications } from '../../context/NotificationContext';
import { ToastNotification } from './ToastNotification';
import './ToastNotification.css';

/**
 * Fixed-position container that renders the active toast notifications from
 * {@link NotificationContext}.
 *
 * Behaviour:
 * - Notifications are rendered in context order, which is most-recent-first,
 *   so the newest notification appears at the top of the stack
 *   (Requirements 10.7).
 * - The container is rendered in a single, consistent fixed screen position
 *   (top-right) regardless of how many toasts are visible (Requirement 10.8).
 * - Success notifications auto-dismiss after 3 seconds. That timing is owned by
 *   the NotificationProvider (see `SUCCESS_AUTO_DISMISS_MS`), so the container
 *   does not schedule a duplicate timer here (Requirement 10.5).
 * - Every toast exposes a manual close button, which satisfies the requirement
 *   that error notifications be dismissable by the user (Requirement 10.6).
 */
export function ToastContainer() {
  const { notifications, dismiss } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-container"
      data-testid="toast-container"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <ToastNotification
          key={notification.id}
          id={notification.id}
          type={notification.type}
          message={notification.message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
