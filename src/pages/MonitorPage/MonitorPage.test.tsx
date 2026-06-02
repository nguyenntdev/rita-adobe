import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NotificationProvider } from '../../context/NotificationContext';
import { EMAIL_VALIDATION_DEBOUNCE_MS } from '../../components/EmailInput/EmailInput';
import type {
  ConnectionStatus,
  WebSocketService,
  WSMessage,
} from '../../types';
import { MonitorPage } from './MonitorPage';

/**
 * Unit tests for the MonitorPage wiring (verifies task 16.1).
 *
 * A controllable fake WebSocketService is injected so the test can drive the
 * status/message callbacks deterministically. Covers:
 *  - start connects with the entered email (Req 7.2)
 *  - connected/disconnected status indicators (Req 7.3, 7.6)
 *  - connect-timeout error + retry (Req 7.7)
 *  - disconnect sends a close request (Req 7.8, 7.9)
 *  - messages render with timestamps through the bounded panel (Req 7.4, 7.1)
 */

/** A fake WebSocketService whose callbacks/status can be driven by the test. */
class FakeWebSocketService implements WebSocketService {
  status: ConnectionStatus = 'disconnected';
  connectCalls: string[] = [];
  disconnectCalls = 0;

  private messageListeners: Array<(m: WSMessage) => void> = [];
  private statusListeners: Array<(s: ConnectionStatus) => void> = [];

  connect(email: string): void {
    this.connectCalls.push(email);
    this.emitStatus('connecting');
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.emitStatus('disconnected');
  }

  onMessage(callback: (message: WSMessage) => void): void {
    this.messageListeners.push(callback);
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.push(callback);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // --- test driving helpers ---
  emitStatus(next: ConnectionStatus): void {
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }

  emitMessage(message: WSMessage): void {
    this.messageListeners.forEach((l) => l(message));
  }
}

function renderPage(service: FakeWebSocketService) {
  return render(
    <NotificationProvider>
      <MonitorPage service={service} />
    </NotificationProvider>,
  );
}

const VALID_EMAIL = 'user@example.com';

function typeEmail(value: string) {
  const input = screen.getByLabelText('Email address') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  // Flush the EmailInput validation debounce so onValidationChange fires and
  // the Start button's enabled state reflects the entered email. Callers wrap
  // this in act(), so the timer advance runs within that act scope.
  jest.advanceTimersByTime(EMAIL_VALIDATION_DEBOUNCE_MS);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('MonitorPage - start/connect (Req 7.2, 7.3)', () => {
  it('disables Start until a valid email is entered', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    const startButton = screen.getByRole('button', { name: /start monitoring/i });
    expect(startButton).toBeDisabled();

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    expect(startButton).not.toBeDisabled();
  });

  it('connects with the entered email and shows the connecting state', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }));

    expect(service.connectCalls).toEqual([VALID_EMAIL]);
    expect(screen.getByTestId('monitor-status').getAttribute('data-status')).toBe(
      'connecting',
    );
  });

  it('shows a connected indicator once the connection opens (Req 7.3)', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }));
    act(() => service.emitStatus('connected'));

    const indicator = screen.getByTestId('monitor-status');
    expect(indicator.getAttribute('data-status')).toBe('connected');
    expect(indicator.getAttribute('data-connected')).toBe('true');
  });
});

describe('MonitorPage - disconnect (Req 7.8, 7.9)', () => {
  it('calls disconnect and moves the indicator to disconnected', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }));
    act(() => service.emitStatus('connected'));

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(service.disconnectCalls).toBe(1);
    expect(screen.getByTestId('monitor-status').getAttribute('data-status')).toBe(
      'disconnected',
    );
  });
});

describe('MonitorPage - connect timeout + retry (Req 7.7)', () => {
  it('shows an error with a Retry action and reconnects on retry', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }));
    // Connect timeout surfaces as an error status from the service.
    act(() => service.emitStatus('error'));

    const errorBanner = screen.getByTestId('monitor-error');
    expect(errorBanner.textContent).toMatch(/timeout/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(service.connectCalls).toEqual([VALID_EMAIL, VALID_EMAIL]);
  });
});

describe('MonitorPage - message rendering (Req 7.4, 7.1)', () => {
  it('renders received messages with their ISO 8601 timestamps', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    act(() => {
      typeEmail(VALID_EMAIL);
    });
    fireEvent.click(screen.getByRole('button', { name: /start monitoring/i }));
    act(() => service.emitStatus('connected'));

    act(() =>
      service.emitMessage({ timestamp: '2026-02-01T10:00:00', content: 'hello' }),
    );

    const rows = screen.getAllByTestId('monitor-message');
    expect(rows).toHaveLength(1);
    expect(
      screen.getByTestId('monitor-message-timestamp').textContent,
    ).toBe('2026-02-01T10:00:00');
    expect(screen.getByTestId('monitor-message-content').textContent).toBe(
      'hello',
    );
  });

  it('passes the 500-message cap to the panel (Req 7.1)', () => {
    const service = new FakeWebSocketService();
    renderPage(service);

    expect(
      screen.getByTestId('monitor-capacity').getAttribute('data-max'),
    ).toBe('500');
  });
});
