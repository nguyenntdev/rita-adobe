import { useEffect } from 'react';
import './ToastNotification.css';

/**
 * Props for a single toast notification.
 *
 * Mirrors the `ToastNotificationProps` interface defined in the design
 * document so the component is reusable on its own, independent of the
 * {@link NotificationContext}.
 */
export interface ToastNotificationProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  /** When true, the toast schedules its own dismissal after `duration` ms. */
  autoDismiss?: boolean;
  /** Auto-dismiss delay in milliseconds. Defaults to {@link DEFAULT_TOAST_DURATION_MS}. */
  duration?: number;
  onDismiss: (id: string) => void;
}

/**
 * Default auto-dismiss delay for a toast (matches the success auto-dismiss
 * window required by Requirement 10.5).
 */
export const DEFAULT_TOAST_DURATION_MS = 3000;

/**
 * A single toast notification.
 *
 * Renders the message with a type-specific style and a manual close button.
 * When `autoDismiss` is enabled it removes itself after `duration` ms via
 * `onDismiss`.
 *
 * Requirements: 10.5 (auto-dismiss), 10.6 (manual close button).
 */
export function ToastNotification({
  id,
  type,
  message,
  autoDismiss = false,
  duration = DEFAULT_TOAST_DURATION_MS,
  onDismiss,
}: ToastNotificationProps) {
  useEffect(() => {
    if (!autoDismiss) {
      return undefined;
    }
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [autoDismiss, duration, id, onDismiss]);

  const isError = type === 'error';

  return (
    <div
      className={`toast toast--${type}`}
      data-testid="toast-notification"
      data-type={type}
      // Errors are assertive so screen readers announce them immediately;
      // success/info are polite.
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="toast__message">{message}</span>
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        &times;
      </button>
    </div>
  );
}
