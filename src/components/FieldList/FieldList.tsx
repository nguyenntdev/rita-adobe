import { useState } from 'react';

import { vi } from '../../i18n/vi';
import {
  formatRecord,
  statusTone,
  type FormattedField,
  type FormattedValue,
} from '../../utils/displayFormat';
import './FieldList.css';

/**
 * Renders an API record as a readable, Vietnamese-labeled field list.
 *
 * Each row is a label + formatted value:
 *  - status values become colored badges,
 *  - booleans become Có/Không chips,
 *  - ISO timestamps are shown as dd/MM/yyyy HH:mm,
 *  - URLs become "Mở liên kết" links with a copy button,
 *  - long multi-line text (e.g. activation notes) keeps its line breaks,
 *  - nested objects/arrays render as indented sub-field lists.
 *
 * This replaces the raw key/value JSON dump so the panels read like a form.
 */
export interface FieldListProps {
  /** The record to render. Empty/absent records show `emptyMessage`. */
  data: Record<string, unknown> | null | undefined;
  /** Message shown when there is nothing to display. */
  emptyMessage: string;
  /** Optional accessible label for the list. */
  label?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently ignore; the value is still visible.
    }
  };

  return (
    <button type="button" className="field-list__copy" onClick={onCopy}>
      {copied ? vi.values.copied : vi.values.copy}
    </button>
  );
}

function ValueView({ value }: { value: FormattedValue }) {
  switch (value.kind) {
    case 'empty':
      return <span className="field-list__empty">{value.text}</span>;
    case 'boolean':
      return (
        <span
          className={`field-list__chip field-list__chip--${
            value.value ? 'yes' : 'no'
          }`}
        >
          {value.text}
        </span>
      );
    case 'status':
      return (
        <span
          className={`field-list__badge field-list__badge--${statusTone(value.raw)}`}
        >
          {value.text}
        </span>
      );
    case 'link':
      return (
        <span className="field-list__link-row">
          <a
            href={value.url}
            target="_blank"
            rel="noopener noreferrer"
            className="field-list__link"
          >
            {vi.values.openLink}
          </a>
          <CopyButton text={value.url} />
        </span>
      );
    case 'nested':
      return (
        <div className="field-list__nested">
          {value.entries.map((entry) => (
            <FieldRow key={entry.key} field={entry} />
          ))}
        </div>
      );
    case 'text':
    default:
      return (
        <span
          className={
            value.kind === 'text' && value.multiline
              ? 'field-list__value field-list__value--multiline'
              : 'field-list__value'
          }
        >
          {value.text}
        </span>
      );
  }
}

function FieldRow({ field }: { field: FormattedField }) {
  return (
    <div className="field-list__row" data-testid="field-row">
      <div className="field-list__label" data-testid="field-label">
        {field.label}
      </div>
      <div className="field-list__value-cell" data-testid="field-value">
        <ValueView value={field.value} />
      </div>
    </div>
  );
}

export function FieldList({ data, emptyMessage, label }: FieldListProps) {
  const keys = data ? Object.keys(data) : [];
  if (keys.length === 0) {
    return (
      <p className="field-list__empty-message" data-testid="field-list-empty">
        {emptyMessage}
      </p>
    );
  }

  const fields = formatRecord(data as Record<string, unknown>);

  return (
    <div className="field-list" aria-label={label} data-testid="field-list">
      {fields.map((field) => (
        <FieldRow key={field.key} field={field} />
      ))}
    </div>
  );
}

export default FieldList;
