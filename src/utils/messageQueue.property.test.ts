import fc from 'fast-check';
import { appendMessage, MAX_QUEUE_SIZE } from './messageQueue';

/**
 * Feature: rita-adobe, Property 3: Bounded WebSocket message queue invariant
 *
 * For any sequence of N WebSocket messages appended to the monitoring queue,
 * the resulting queue length SHALL equal min(N, 500), the queue SHALL retain
 * exactly the most recent 500 messages (evicting the oldest first when the
 * limit is exceeded), and the arrival order of retained messages SHALL be
 * preserved.
 *
 * Validates: Requirements 7.1, 7.5
 */
describe('Property 3: Bounded WebSocket message queue invariant', () => {
  it('caps at min(N, 500), retains the most-recent 500 in arrival order, evicting oldest first', () => {
    fc.assert(
      fc.property(
        // A sequence of 0–1000 unique messages so we can verify identity/order.
        fc.integer({ min: 0, max: 1000 }).chain((n) =>
          fc.constant(
            Array.from({ length: n }, (_, index) => ({
              id: index,
              content: `message-${index}`,
            })),
          ),
        ),
        (messages) => {
          const n = messages.length;

          // Build the queue by appending messages one at a time, mirroring how
          // the monitoring panel receives them over time.
          const queue = messages.reduce<typeof messages>(
            (acc, message) => appendMessage(acc, message, MAX_QUEUE_SIZE),
            [],
          );

          // Final length is min(N, 500).
          expect(queue.length).toBe(Math.min(n, MAX_QUEUE_SIZE));

          // Retains exactly the most-recent 500 (oldest evicted first), in
          // arrival order.
          const expected = messages.slice(Math.max(0, n - MAX_QUEUE_SIZE));
          expect(queue).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
