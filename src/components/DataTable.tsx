import type { CSSProperties } from 'react';
import { stringifyValue } from './KeyValueDisplay';

/**
 * A single tabular record. Fields are dynamic; columns are derived from the
 * union of keys across all records.
 */
export type DataTableRecord = Record<string, unknown>;

/**
 * Props for {@link DataTable}.
 */
export interface DataTableProps {
  /**
   * The records to render. Column headers cover the union of every field key
   * across all records, and each row renders every field (Requirements 3.3).
   */
  records: DataTableRecord[] | null | undefined;
  /**
   * Message shown when there are no records to display (Requirement 3.4).
   */
  emptyMessage?: string;
  /** Optional accessible caption/label for the table. */
  label?: string;
}

/**
 * Computes the ordered union of keys across all records.
 *
 * Keys are collected in first-seen order: the keys of the first record come
 * first, then any new keys introduced by subsequent records, and so on. A `Set`
 * guarantees each key appears exactly once while preserving insertion order.
 * The result is the set of column headers the table renders.
 */
export function unionOfKeys(records: DataTableRecord[]): string[] {
  const keys = new Set<string>();
  for (const record of records) {
    if (record) {
      for (const key of Object.keys(record)) {
        keys.add(key);
      }
    }
  }
  return [...keys];
}

const tableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: 13,
};

const cellStyle: CSSProperties = {
  border: '1px solid var(--stroke)',
  padding: '8px 12px',
  textAlign: 'left',
  verticalAlign: 'top',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'var(--font-mono)',
  color: 'var(--fg-secondary)',
};

const headerCellStyle: CSSProperties = {
  ...cellStyle,
  backgroundColor: 'var(--bg-layer-alt)',
  fontWeight: 600,
  fontFamily: 'var(--font-base)',
  color: 'var(--fg-default)',
};

const emptyStyle: CSSProperties = {
  padding: 'var(--sp-l, 16px)',
  margin: 0,
  color: 'var(--fg-muted)',
};

/**
 * Renders an array of records as a table.
 *
 * The column headers cover the union of all field keys across every record, so
 * a field present in any record gets a column. Each row renders a cell for
 * every column; when a record lacks a given key, the cell is rendered empty so
 * the row stays aligned with the headers. Every present field is stringified
 * via {@link stringifyValue}, omitting none.
 *
 * When there are no records, an empty-state message is shown instead
 * (Requirement 3.4).
 */
export function DataTable({
  records,
  emptyMessage = 'No data available.',
  label,
}: DataTableProps) {
  const rows = records ?? [];
  const columns = unionOfKeys(rows);

  // No records at all, or records that contribute no keys: nothing to tabulate.
  if (rows.length === 0 || columns.length === 0) {
    return (
      <p style={emptyStyle} data-testid="data-table-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <table style={tableStyle} aria-label={label} data-testid="data-table">
      <thead>
        <tr data-testid="data-table-header-row">
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              style={headerCellStyle}
              data-testid="data-table-header"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((record, rowIndex) => (
          // Records have no stable id; the row index preserves source order.
          <tr key={rowIndex} data-testid="data-table-row">
            {columns.map((column) => {
              const hasField =
                record != null &&
                Object.prototype.hasOwnProperty.call(record, column);
              return (
                <td
                  key={column}
                  style={cellStyle}
                  data-testid="data-table-cell"
                  data-column={column}
                  data-present={hasField}
                >
                  {hasField ? stringifyValue(record[column]) : ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;
