import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * A single user-facing notification (toast).
 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

/**
 * Public API exposed by the NotificationContext.
 *
 * `notifications` is ordered most-recent-first: the most recently added
 * notification is always at index 0 (the top of the rendered stack).
 */
export interface NotificationContextValue {
  notifications: Notification[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  dismiss: (id: string) => void;
}

/**
 * How long (ms) a success notification stays visible before auto-dismissal.
 */
export const SUCCESS_AUTO_DISMISS_MS = 3000;

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Generates a reasonably unique id for a notification. A monotonically
 * increasing counter guarantees uniqueness even when several notifications are
 * created within the same millisecond.
 */
function createIdGenerator(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `notification-${Date.now()}-${counter}`;
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextId = useRef(createIdGenerator());

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  const add = useCallback(
    (type: Notification['type'], message: string) => {
      const notification: Notification = {
        id: nextId.current(),
        type,
        message,
        timestamp: new Date(),
      };

      // Prepend so the most recently added notification is at the top.
      setNotifications((current) => [notification, ...current]);

      // Success notifications auto-dismiss after a fixed delay.
      if (type === 'success') {
        setTimeout(() => {
          dismiss(notification.id);
        }, SUCCESS_AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const showSuccess = useCallback(
    (message: string) => add('success', message),
    [add],
  );
  const showError = useCallback(
    (message: string) => add('error', message),
    [add],
  );
  const showInfo = useCallback(
    (message: string) => add('info', message),
    [add],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, showSuccess, showError, showInfo, dismiss }),
    [notifications, showSuccess, showError, showInfo, dismiss],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook for consuming the notification context. Throws if used outside a
 * {@link NotificationProvider}.
 */
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (context === null) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
}

export { NotificationContext };
