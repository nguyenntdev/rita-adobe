import type { CSSProperties } from 'react';

/**
 * Renders an arbitrary value as a display string for key-value / tabular output.
 *
 * The function is total and deterministic so that the data-display components
 * (and their tests) can rely on a single, predictable stringification:
 *
 * - strings are shown verbatim (no surrounding quotes),
 * - `null` / `undefined` render as the literal words `null` / `undefined`,
 * - everything else is JSON-stringified so structured payloads stay legible,
 * - values that cannot be serialized (e.g. circular structures, BigInt) fall
 *   back to `String(value)`.
 *
 * This guarantees that for any record, every value produces a non-omitted,
 * human-readable string (Property 5: API Response Data Display Completeness).
 */
export function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  try {
    const json = JSON.stringify(value);
    // JSON.stringify can return undefined (e.g. for a function); fall back.
    return json ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Props for {@link KeyValueDisplay}.
 */
export interface KeyValueDisplayProps {
  /**
   * The record to render. Every own-enumerable key is rendered with its
   * stringified value, omitting none (Requirements 2.3, 4.3).
   */
  data: Record<string, unknown> | null | undefined;
  /**
   * Message shown when there is no data to display (Requirement 4.4).
   */
  emptyMessage?: string;
  /** Optional accessible label for the list. */
  label?: string;
}

const listStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, max-content) 1fr',
  gap: '8px 16px',
  margin: 0,
  padding: 'var(--sp-l, 16px)',
};

const keyStyle: CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
  wordBreak: 'break-word',
};

const valueStyle: CSSProperties = {
  margin: 0,
  color: 'var(--fg-secondary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'var(--font-mono)',
};

const emptyStyle: CSSProperties = {
  padding: 'var(--sp-l, 16px)',
  margin: 0,
  color: 'var(--fg-muted)',
};

/**
 * Displays a record as a labeled key-value list.
 *
 * Iterates the record's own-enumerable keys (via `Object.keys`) so that every
 * key returned by the API appears alongside its stringified value, with none
 * omitted. When the record is `null`, `undefined`, or has no keys, an
 * empty-state message is shown instead.
 */
export function KeyValueDisplay({
  data,
  emptyMessage = 'No data available.',
  label,
}: KeyValueDisplayProps) {
  const keys = data ? Object.keys(data) : [];

  if (keys.length === 0) {
    return (
      <p style={emptyStyle} data-testid="key-value-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <dl style={listStyle} aria-label={label} data-testid="key-value-display">
      {keys.map((key) => (
        // Object keys are unique, so the key itself is a stable React key.
        <div key={key} style={{ display: 'contents' }} data-testid="key-value-row">
          <dt style={keyStyle} data-testid="key-value-key">
            {key}
          </dt>
          <dd style={valueStyle} data-testid="key-value-value">
            {stringifyValue((data as Record<string, unknown>)[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default KeyValueDisplay;
