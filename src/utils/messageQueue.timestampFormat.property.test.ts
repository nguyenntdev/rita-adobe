import fc from 'fast-check';
import { appendMessage, formatTimestamp } from './messageQueue';
import type { WSMessage } from '../types';

/**
 * Feature: rita-adobe, Property 4: WebSocket message timestamp format
 *
 * Validates: Requirements 7.4
 *
 * For any WebSocket message appended to the monitoring panel, the recorded
 * timestamp SHALL match the ISO 8601 pattern `YYYY-MM-DDTHH:mm:ss` and SHALL
 * represent the time the message was received by the client.
 *
 * This mirrors how `webSocketService` records an incoming frame: it stamps the
 * message with `formatTimestamp()` and routes it through the bounded queue via
 * `appendMessage` (Requirements 7.4, 7.5).
 */
describe('Property 4: WebSocket message timestamp format', () => {
  const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

  // Constrain receive times to four-digit-year instants so the formatted
  // output stays within the YYYY-MM-DDTHH:mm:ss pattern. `formatTimestamp`
  // renders in local time, so the UTC range is pulled in by more than the
  // widest timezone offset (UTC-12..UTC+14) to ensure the local-time year
  // never crosses below 1000 or above 9999.
  const receiveTime = fc.date({
    min: new Date('1000-01-03T00:00:00.000Z'),
    max: new Date('9999-12-29T00:00:00.000Z'),
    noInvalidDate: true,
  });

  it('records an ISO 8601 timestamp equal to the formatted receive time', () => {
    fc.assert(
      fc.property(fc.anything(), receiveTime, (payload, receivedAt) => {
        // Record the message exactly as the WebSocket service does: stamp it
        // with the formatted receive time and route it through the queue.
        const message: WSMessage = {
          timestamp: formatTimestamp(receivedAt),
          content: payload,
        };
        const queue = appendMessage<WSMessage>([], message);
        const recorded = queue[queue.length - 1];

        // Matches the required ISO 8601 (YYYY-MM-DDTHH:mm:ss) pattern.
        expect(recorded.timestamp).toMatch(ISO_8601_PATTERN);

        // Represents exactly the time the message was received by the client.
        expect(recorded.timestamp).toBe(formatTimestamp(receivedAt));
      }),
      { numRuns: 100 },
    );
  });
});
