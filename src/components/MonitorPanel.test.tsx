import { cleanup, render, screen, within } from '@testing-library/react';
import type { WSMessage } from '../types';
import { MonitorPanel } from './MonitorPanel';

/**
 * Unit tests for the MonitorPanel component.
 *
 * Covers message rendering with ISO 8601 timestamps (Requirement 7.4),
 * the connected/disconnected status indicator (Requirements 7.3, 7.6), and
 * the 500-message cap visualization (Requirements 7.1, 7.5).
 *
 * Uses plain Jest matchers (no jest-dom matchers) to match the project's
 * existing test configuration.
 */

afterEach(cleanup);

function makeMessage(timestamp: string, content: unknown): WSMessage {
  return { timestamp, content };
}

describe('MonitorPanel - message rendering (Req 7.4)', () => {
  it('renders each message with its ISO 8601 timestamp in arrival order', () => {
    const messages: WSMessage[] = [
      makeMessage('2026-02-01T10:00:00', 'first'),
      makeMessage('2026-02-01T10:00:01', 'second'),
      makeMessage('2026-02-01T10:00:02', 'third'),
    ];

    render(
      <MonitorPanel messages={messages} maxMessages={500} status="connected" />,
    );

    const rows = screen.getAllByTestId('monitor-message');
    expect(rows).toHaveLength(3);

    const timestamps = screen
      .getAllByTestId('monitor-message-timestamp')
      .map((node) => node.textContent);
    expect(timestamps).toEqual([
      '2026-02-01T10:00:00',
      '2026-02-01T10:00:01',
      '2026-02-01T10:00:02',
    ]);

    // Timestamps follow the YYYY-MM-DDTHH:mm:ss pattern.
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    timestamps.forEach((ts) => expect(ts).toMatch(isoPattern));

    // The first row pairs its timestamp with the matching content.
    expect(
      within(rows[0]).getByTestId('monitor-message-content').textContent,
    ).toBe('first');
  });

  it('stringifies non-string message content', () => {
    const messages: WSMessage[] = [
      makeMessage('2026-02-01T10:00:00', { event: 'update', value: 42 }),
    ];

    render(
      <MonitorPanel messages={messages} maxMessages={500} status="connected" />,
    );

    expect(screen.getByTestId('monitor-message-content').textContent).toBe(
      '{"event":"update","value":42}',
    );
  });

  it('shows an empty state when there are no messages', () => {
    render(<MonitorPanel messages={[]} maxMessages={500} status="disconnected" />);

    expect(screen.getByTestId('monitor-empty')).not.toBeNull();
    expect(screen.queryAllByTestId('monitor-message')).toHaveLength(0);
  });
});

describe('MonitorPanel - status indicator (Req 7.3, 7.6)', () => {
  it('shows a connected indicator while the connection is active', () => {
    render(<MonitorPanel messages={[]} maxMessages={500} status="connected" />);

    const indicator = screen.getByTestId('monitor-status');
    expect(indicator.getAttribute('data-status')).toBe('connected');
    expect(indicator.getAttribute('data-connected')).toBe('true');
    expect(indicator.textContent).toMatch(/connected/i);
  });

  it('shows a disconnected indicator when the connection is closed', () => {
    render(
      <MonitorPanel messages={[]} maxMessages={500} status="disconnected" />,
    );

    const indicator = screen.getByTestId('monitor-status');
    expect(indicator.getAttribute('data-status')).toBe('disconnected');
    expect(indicator.getAttribute('data-connected')).toBe('false');
    expect(indicator.textContent).toMatch(/disconnected/i);
  });

  it('reflects connecting and error states distinctly', () => {
    const { rerender } = render(
      <MonitorPanel messages={[]} maxMessages={500} status="connecting" />,
    );
    expect(
      screen.getByTestId('monitor-status').getAttribute('data-status'),
    ).toBe('connecting');

    rerender(<MonitorPanel messages={[]} maxMessages={500} status="error" />);
    const indicator = screen.getByTestId('monitor-status');
    expect(indicator.getAttribute('data-status')).toBe('error');
    expect(indicator.textContent).toMatch(/error/i);
  });
});

describe('MonitorPanel - cap visualization (Req 7.1, 7.5)', () => {
  it('reports the message count against the maximum', () => {
    const messages = Array.from({ length: 3 }, (_, i) =>
      makeMessage(`2026-02-01T10:00:0${i}`, `msg-${i}`),
    );

    render(
      <MonitorPanel messages={messages} maxMessages={500} status="connected" />,
    );

    const capacity = screen.getByTestId('monitor-capacity');
    expect(capacity.getAttribute('data-count')).toBe('3');
    expect(capacity.getAttribute('data-max')).toBe('500');
    expect(capacity.textContent).toBe('3 / 500 messages');
  });

  it('caps the progress bar at the maximum when the queue is full', () => {
    const messages = Array.from({ length: 500 }, (_, i) =>
      makeMessage('2026-02-01T10:00:00', `msg-${i}`),
    );

    render(
      <MonitorPanel messages={messages} maxMessages={500} status="connected" />,
    );

    const bar = screen.getByTestId('monitor-capacity-bar');
    expect(bar.getAttribute('aria-valuenow')).toBe('500');
    expect(bar.getAttribute('aria-valuemax')).toBe('500');
  });

  it('does not exceed the maximum in the progressbar value', () => {
    // Defensive: even if more than the cap is passed, the bar clamps.
    const messages = Array.from({ length: 600 }, (_, i) =>
      makeMessage('2026-02-01T10:00:00', `msg-${i}`),
    );

    render(
      <MonitorPanel messages={messages} maxMessages={500} status="connected" />,
    );

    expect(
      screen.getByTestId('monitor-capacity-bar').getAttribute('aria-valuenow'),
    ).toBe('500');
  });

  it('handles a zero maximum without dividing by zero', () => {
    render(<MonitorPanel messages={[]} maxMessages={0} status="disconnected" />);

    expect(
      screen.getByTestId('monitor-capacity-bar').getAttribute('aria-valuenow'),
    ).toBe('0');
  });
});
