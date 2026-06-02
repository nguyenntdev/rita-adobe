/**
 * Display formatting helpers for rendering API data in readable Vietnamese.
 *
 * The ADES API returns records with raw English keys, ISO timestamps, nested
 * objects, and booleans. These helpers turn that into human-friendly labels and
 * values so the result panels read like a form, not a JSON dump.
 */
import { vi } from '../i18n/vi';

/** Turn a camelCase / snake_case key into a spaced, capitalized phrase. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Vietnamese label for a field key (known map → humanized fallback). */
export function fieldLabel(key: string): string {
  return vi.fields[key] ?? humanizeKey(key);
}

/** Vietnamese display text for a status value (known map → verbatim). */
export function statusLabel(status: string): string {
  return vi.statusValues[status.trim().toLowerCase()] ?? status;
}

/** A single ISO 8601-ish string detector. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

/** Format an ISO timestamp as Vietnamese local date-time (dd/MM/yyyy HH:mm). */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Kinds of formatted values, so the renderer can style each appropriately. */
export type FormattedValue =
  | { kind: 'text'; text: string; multiline?: boolean }
  | { kind: 'empty'; text: string }
  | { kind: 'boolean'; value: boolean; text: string }
  | { kind: 'status'; raw: string; text: string }
  | { kind: 'link'; url: string }
  | { kind: 'nested'; entries: FormattedField[] };

/** A label + formatted value pair. */
export interface FormattedField {
  key: string;
  label: string;
  value: FormattedValue;
}

/** Whether a string looks like an http(s) URL. */
function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Format a single value into a {@link FormattedValue}, recursing into plain
 * objects. `key` is used to special-case status fields and date-like keys.
 */
export function formatValue(key: string, value: unknown): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { kind: 'empty', text: vi.values.none };
  }

  if (typeof value === 'boolean') {
    return {
      kind: 'boolean',
      value,
      text: value ? vi.values.yes : vi.values.no,
    };
  }

  if (typeof value === 'number') {
    return { kind: 'text', text: String(value) };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { kind: 'empty', text: vi.values.empty };
    }
    if (key.toLowerCase() === 'status') {
      return { kind: 'status', raw: trimmed, text: statusLabel(trimmed) };
    }
    if (isUrl(trimmed)) {
      return { kind: 'link', url: trimmed };
    }
    if (isIsoDate(trimmed)) {
      return { kind: 'text', text: formatDateTime(trimmed) };
    }
    // Multi-line text (e.g. the long activation note) keeps its line breaks.
    return { kind: 'text', text: trimmed, multiline: trimmed.includes('\n') };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: 'empty', text: vi.values.none };
    }
    // Render an array as a nested list keyed by index.
    return {
      kind: 'nested',
      entries: value.map((item, index) => ({
        key: String(index),
        label: `#${index + 1}`,
        value: formatValue(String(index), item),
      })),
    };
  }

  if (typeof value === 'object') {
    return { kind: 'nested', entries: formatRecord(value as Record<string, unknown>) };
  }

  return { kind: 'text', text: String(value) };
}

/** Format an entire record into ordered label/value fields. */
export function formatRecord(data: Record<string, unknown>): FormattedField[] {
  return Object.keys(data).map((key) => ({
    key,
    label: fieldLabel(key),
    value: formatValue(key, data[key]),
  }));
}

/** Status → semantic tone for badge coloring. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export function statusTone(raw: string): StatusTone {
  const s = raw.trim().toLowerCase();
  if (['active', 'completed'].includes(s)) {
    return 'success';
  }
  if (['processing', 'pending'].includes(s)) {
    return 'warning';
  }
  if (['expired', 'cancelled', 'canceled', 'failed', 'suspended', 'inactive'].includes(s)) {
    return 'danger';
  }
  return 'neutral';
}
