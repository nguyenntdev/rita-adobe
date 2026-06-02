import { cleanup, render, screen, within } from '@testing-library/react';
import fc from 'fast-check';
import { KeyValueDisplay, stringifyValue } from './KeyValueDisplay';
import { DataTable, unionOfKeys, type DataTableRecord } from './DataTable';

/**
 * Feature: rita-adobe, Property 5: API response data display completeness
 *
 * For any successful API response containing key-value or record data, the
 * rendering SHALL include every key returned by the API and the stringified
 * value for each key, omitting none. For tabular data, the column headers SHALL
 * cover the union of all field keys across records and each row SHALL render
 * each field.
 *
 * The defined stringification (`stringifyValue`) is used as the oracle for the
 * expected display string of each value, so the test asserts both completeness
 * (no key/field omitted) and correctness (the right stringified value renders).
 *
 * Validates: Requirements 2.3, 3.3, 4.3
 */

// An arbitrary JSON-ish value: the kinds of payloads the ADES API returns for
// account status, 12-hour records, and variable data. Includes primitives,
// null, nested arrays, and nested objects so stringification is exercised.
const valueArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { maxDepth: 2, depthIdentifier: 'value' },
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string(), tie('value'), { maxKeys: 4 }),
  ),
})).value;

// An arbitrary record (key-value object) with string keys and arbitrary values.
const recordArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.string(),
  valueArb,
  { maxKeys: 6 },
);

describe('Property 5: API response data display completeness', () => {
  afterEach(cleanup);

  it('KeyValueDisplay renders every key with its stringified value, omitting none', () => {
    fc.assert(
      fc.property(recordArb, (data) => {
        const { unmount } = render(<KeyValueDisplay data={data} />);
        try {
          const keys = Object.keys(data);

          if (keys.length === 0) {
            // Empty records show the empty state rather than a key-value list.
            expect(screen.getByTestId('key-value-empty')).toBeInTheDocument();
            expect(
              screen.queryByTestId('key-value-display'),
            ).not.toBeInTheDocument();
            return;
          }

          // Every key is rendered, in the record's own-key order, none omitted.
          const renderedKeys = screen
            .getAllByTestId('key-value-key')
            .map((node) => node.textContent);
          expect(renderedKeys).toEqual(keys);

          // Every value is rendered as its stringified form, aligned to its key.
          const renderedValues = screen
            .getAllByTestId('key-value-value')
            .map((node) => node.textContent);
          const expectedValues = keys.map((key) => stringifyValue(data[key]));
          expect(renderedValues).toEqual(expectedValues);
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('DataTable headers cover the union of keys and every field renders per row', () => {
    fc.assert(
      fc.property(fc.array(recordArb, { maxLength: 6 }), (records) => {
        const { unmount } = render(<DataTable records={records} />);
        try {
          const columns = unionOfKeys(records as DataTableRecord[]);

          if (records.length === 0 || columns.length === 0) {
            // No records, or records that contribute no keys: empty state.
            expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();
            expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
            return;
          }

          // Headers cover exactly the union of all field keys across records.
          const headers = screen
            .getAllByTestId('data-table-header')
            .map((node) => node.textContent);
          expect(headers).toEqual(columns);

          // One row per record, and each row renders one cell per column with
          // the correct stringified value (blank only when the field is absent).
          const rows = screen.getAllByTestId('data-table-row');
          expect(rows).toHaveLength(records.length);

          rows.forEach((row, rowIndex) => {
            const cells = within(row).getAllByTestId('data-table-cell');
            expect(cells).toHaveLength(columns.length);

            const record = records[rowIndex];
            columns.forEach((column, colIndex) => {
              const cell = cells[colIndex];
              const present = Object.prototype.hasOwnProperty.call(
                record,
                column,
              );
              expect(cell.getAttribute('data-present')).toBe(String(present));
              expect(cell.textContent).toBe(
                present ? stringifyValue(record[column]) : '',
              );
            });
          });
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 },
    );
  });
});
