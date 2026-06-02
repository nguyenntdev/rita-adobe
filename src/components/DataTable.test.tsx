import { cleanup, render, screen, within } from '@testing-library/react';
import { DataTable, unionOfKeys } from './DataTable';

/**
 * Unit tests for DataTable (Requirements 3.3, 3.4).
 *
 * These verify concrete examples and edge cases. The universal completeness
 * property (Property 5) is covered separately by the data-display property test
 * (task 11.3).
 */
describe('DataTable', () => {
  afterEach(cleanup);

  it('renders headers covering the union of keys across records', () => {
    const records = [
      { id: 1, name: 'Alice' },
      { id: 2, email: 'bob@example.com' },
    ];

    render(<DataTable records={records} />);

    const headers = screen
      .getAllByTestId('data-table-header')
      .map((n) => n.textContent);
    // First-seen order: id, name (from row 0), then email (new in row 1).
    expect(headers).toEqual(['id', 'name', 'email']);
  });

  it('renders one cell per column for every row, blank when field is absent', () => {
    const records = [
      { id: 1, name: 'Alice' },
      { id: 2, email: 'bob@example.com' },
    ];

    render(<DataTable records={records} />);

    const rows = screen.getAllByTestId('data-table-row');
    expect(rows).toHaveLength(2);

    // Each row has exactly one cell per column (3 columns).
    rows.forEach((row) => {
      expect(within(row).getAllByTestId('data-table-cell')).toHaveLength(3);
    });

    // Row 0: id=1, name=Alice, email missing (blank).
    const row0Cells = within(rows[0]).getAllByTestId('data-table-cell');
    expect(row0Cells[0]).toHaveTextContent('1');
    expect(row0Cells[1]).toHaveTextContent('Alice');
    expect(row0Cells[2]).toHaveTextContent('');
    expect(row0Cells[2].getAttribute('data-present')).toBe('false');

    // Row 1: id=2, name missing (blank), email present.
    const row1Cells = within(rows[1]).getAllByTestId('data-table-cell');
    expect(row1Cells[0]).toHaveTextContent('2');
    expect(row1Cells[1]).toHaveTextContent('');
    expect(row1Cells[1].getAttribute('data-present')).toBe('false');
    expect(row1Cells[2]).toHaveTextContent('bob@example.com');
  });

  it('stringifies structured field values', () => {
    const records = [{ tags: ['a', 'b'], meta: { active: true } }];
    render(<DataTable records={records} />);

    const table = screen.getByTestId('data-table');
    expect(within(table).getByText('["a","b"]')).toBeInTheDocument();
    expect(within(table).getByText('{"active":true}')).toBeInTheDocument();
  });

  it('shows the empty message when there are no records', () => {
    render(<DataTable records={[]} emptyMessage="No 12-hour data available" />);
    expect(screen.getByTestId('data-table-empty')).toHaveTextContent(
      'No 12-hour data available',
    );
    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
  });

  it('shows the empty message when records is null or undefined', () => {
    const { rerender } = render(<DataTable records={null} />);
    expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();

    rerender(<DataTable records={undefined} />);
    expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();
  });

  it('shows the empty message when records contribute no keys', () => {
    render(<DataTable records={[{}, {}]} />);
    expect(screen.getByTestId('data-table-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
  });
});

describe('unionOfKeys', () => {
  it('returns the first-seen ordered union of keys', () => {
    const records = [
      { a: 1, b: 2 },
      { b: 3, c: 4 },
      { a: 5, d: 6 },
    ];
    expect(unionOfKeys(records)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty array for no records', () => {
    expect(unionOfKeys([])).toEqual([]);
  });

  it('deduplicates keys appearing in multiple records', () => {
    const records = [{ x: 1 }, { x: 2 }, { x: 3 }];
    expect(unionOfKeys(records)).toEqual(['x']);
  });
});
