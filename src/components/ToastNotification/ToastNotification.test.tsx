import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastNotification } from './ToastNotification';
import { ToastContainer } from './ToastContainer';
import {
  NotificationProvider,
  useNotifications,
  type NotificationContextValue,
} from '../../context/NotificationContext';

/**
 * Unit/component tests for the ToastNotification component and the
 * NotificationContext-backed ToastContainer.
 *
 * Covers Requirements:
 * - 10.5: success notifications auto-dismiss after 3 seconds
 * - 10.6: error notifications expose a manual close button
 * - 10.7: notifications stack most-recent-first (newest on top)
 * - 10.8: toasts render in a single consistent container position
 */

describe('ToastNotification component', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the message and type', () => {
    const onDismiss = jest.fn();
    render(
      <ToastNotification
        id="t1"
        type="error"
        message="Something failed"
        onDismiss={onDismiss}
      />,
    );

    const toast = screen.getByTestId('toast-notification');
    expect(toast).toHaveTextContent('Something failed');
    expect(toast.getAttribute('data-type')).toBe('error');
    expect(toast).toHaveAttribute('role', 'alert');
  });

  it('invokes onDismiss with the id when the close button is clicked (Req 10.6)', () => {
    const onDismiss = jest.fn();
    render(
      <ToastNotification
        id="t-close"
        type="error"
        message="Dismiss me"
        onDismiss={onDismiss}
      />,
    );

    screen.getByRole('button', { name: /dismiss notification/i }).click();
    expect(onDismiss).toHaveBeenCalledWith('t-close');
  });

  it('auto-dismisses after the given duration when autoDismiss is set (Req 10.5)', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(
      <ToastNotification
        id="t-auto"
        type="success"
        message="Done"
        autoDismiss
        duration={3000}
        onDismiss={onDismiss}
      />,
    );

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledWith('t-auto');
  });

  it('does not auto-dismiss when autoDismiss is not set', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(
      <ToastNotification
        id="t-stay"
        type="error"
        message="Stay"
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('ToastContainer', () => {
  let api: NotificationContextValue | null = null;

  function CaptureApi() {
    api = useNotifications();
    return null;
  }

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    api = null;
  });

  it('renders nothing when there are no notifications', () => {
    render(
      <NotificationProvider>
        <ToastContainer />
      </NotificationProvider>,
    );
    expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument();
  });

  it('stacks notifications newest-on-top in a single container (Req 10.7, 10.8)', () => {
    jest.useFakeTimers();
    render(
      <NotificationProvider>
        <CaptureApi />
        <ToastContainer />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showError('first');
      (api as NotificationContextValue).showError('second');
      (api as NotificationContextValue).showError('third');
    });

    const containers = screen.getAllByTestId('toast-container');
    expect(containers).toHaveLength(1);

    const items = screen.getAllByTestId('toast-notification');
    const messages = items.map(
      (n) => n.querySelector('.toast__message')?.textContent,
    );
    expect(messages).toEqual(['third', 'second', 'first']);
  });

  it('auto-dismisses a success notification after 3s but keeps errors (Req 10.5, 10.6)', () => {
    jest.useFakeTimers();
    render(
      <NotificationProvider>
        <CaptureApi />
        <ToastContainer />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showSuccess('saved');
      (api as NotificationContextValue).showError('boom');
    });

    expect(screen.getAllByTestId('toast-notification')).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    const remaining = screen.getAllByTestId('toast-notification');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveTextContent('boom');
  });

  it('removes a notification when its close button is clicked (Req 10.6)', () => {
    jest.useFakeTimers();
    render(
      <NotificationProvider>
        <CaptureApi />
        <ToastContainer />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showError('close me');
    });

    act(() => {
      screen.getByRole('button', { name: /dismiss notification/i }).click();
    });

    expect(screen.queryByTestId('toast-notification')).not.toBeInTheDocument();
  });

  it('keeps a success notification visible just before 3s and removes it exactly at 3s (Req 10.5)', () => {
    jest.useFakeTimers();
    render(
      <NotificationProvider>
        <CaptureApi />
        <ToastContainer />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showSuccess('saved');
    });

    expect(screen.getByTestId('toast-notification')).toHaveTextContent('saved');

    // One millisecond before the 3s window the toast must still be present.
    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId('toast-notification')).toHaveTextContent('saved');

    // Crossing the 3s boundary dismisses it.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('toast-notification')).not.toBeInTheDocument();
  });

  it('manually dismisses only the targeted toast, leaving the others stacked (Req 10.6, 10.7)', () => {
    jest.useFakeTimers();
    render(
      <NotificationProvider>
        <CaptureApi />
        <ToastContainer />
      </NotificationProvider>,
    );

    act(() => {
      (api as NotificationContextValue).showError('alpha');
      (api as NotificationContextValue).showError('beta');
      (api as NotificationContextValue).showError('gamma');
    });

    // Stack is newest-on-top: gamma, beta, alpha. Dismiss the middle one.
    const closeButtons = screen.getAllByRole('button', {
      name: /dismiss notification/i,
    });
    expect(closeButtons).toHaveLength(3);
    act(() => {
      closeButtons[1].click();
    });

    const remaining = screen
      .getAllByTestId('toast-notification')
      .map((n) => n.querySelector('.toast__message')?.textContent);
    expect(remaining).toEqual(['gamma', 'alpha']);
  });
});
