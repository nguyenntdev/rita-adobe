/**
 * Bounded WebSocket message queue and ISO 8601 timestamp formatter.
 *
 * The monitoring panel displays at most {@link MAX_QUEUE_SIZE} messages
 * (Requirement 7.1). When the limit is exceeded, the oldest message is evicted
 * before the new one is appended, preserving arrival order (Requirement 7.5).
 *
 * Each received message is recorded with an ISO 8601 timestamp in the
 * `YYYY-MM-DDTHH:mm:ss` format (Requirement 7.4).
 */

/** Maximum number of messages retained in the monitoring queue (Requirement 7.1). */
export const MAX_QUEUE_SIZE = 500;

/**
 * Appends a message to the bounded queue.
 *
 * The queue is capped at `maxSize`; once the limit is exceeded the oldest
 * messages are evicted first while the arrival order of the retained messages
 * is preserved (Requirements 7.1, 7.5). The input queue is treated as
 * immutable — a new array is always returned.
 *
 * @param queue   The current queue (oldest first, newest last).
 * @param message The message to append.
 * @param maxSize The maximum queue length (defaults to {@link MAX_QUEUE_SIZE}).
 * @returns A new bounded queue with `message` appended.
 */
export function appendMessage<T>(
  queue: readonly T[],
  message: T,
  maxSize: number = MAX_QUEUE_SIZE,
): T[] {
  const appended = [...queue, message];
  if (appended.length <= maxSize) {
    return appended;
  }
  // Drop the oldest messages, keeping the most recent `maxSize` in order.
  return appended.slice(appended.length - maxSize);
}

/**
 * Formats a date as an ISO 8601 local timestamp `YYYY-MM-DDTHH:mm:ss`
 * (Requirement 7.4). Used when recording the arrival time of each message.
 *
 * @param date The instant to format (defaults to now).
 */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
