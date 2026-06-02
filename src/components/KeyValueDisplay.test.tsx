import { cleanup, render, screen, within } from '@testing-library/react';
import {
  KeyValueDisplay,
  stringifyValue,
} from './KeyValueDisplay';

/**
 * Unit tests for KeyValueDisplay (Requirements 2.3, 4.3, 4.4).
 *
 * These verify concrete examples and edge cases. The universal completeness
 * property (Property 5) is covered separately by the data-display property test
 * (task 11.3).
 */
describe('KeyValueDisplay', () => {
  afterEach(cleanup);

  it('renders every key and its stringified value', () => {
    const data = {
      email: 'user@example.com',
      status: 'active',
      attempts: 3,
      verified: true,
    };

    render(<KeyValueDisplay data={data} />);

    const keys = screen.getAllByTestId('key-value-key').map((n) => n.textContent);
    expect(keys).toEqual(['email', 'status', 'attempts', 'verified']);

    const values = screen
      .getAllByTestId('key-value-value')
      .map((n) => n.textContent);
    expect(values).toEqual(['user@example.com', 'active', '3', 'true']);
  });

  it('renders a row per key, omitting none', () => {
    const data = { a: 1, b: 2, c: 3 };
    render(<KeyValueDisplay data={data} />);
    expect(screen.getAllByTestId('key-value-row')).toHaveLength(3);
  });

  it('stringifies nested objects and arrays', () => {
    const data = {
      nested: { foo: 'bar' },
      list: [1, 2, 3],
    };
    render(<KeyValueDisplay data={data} />);

    const display = screen.getByTestId('key-value-display');
    expect(within(display).getByText('{"foo":"bar"}')).toBeInTheDocument();
    expect(within(display).getByText('[1,2,3]')).toBeInTheDocument();
  });

  it('renders null and undefined values as literal words', () => {
    const data = { a: null, b: undefined };
    render(<KeyValueDisplay data={data} />);

    const values = screen
      .getAllByTestId('key-value-value')
      .map((n) => n.textContent);
    expect(values).toEqual(['null', 'undefined']);
  });

  it('shows the empty message for an empty record', () => {
    render(<KeyValueDisplay data={{}} emptyMessage="No variable data" />);
    expect(screen.getByTestId('key-value-empty')).toHaveTextContent(
      'No variable data',
    );
    expect(screen.queryByTestId('key-value-display')).not.toBeInTheDocument();
  });

  it('shows the empty message when data is null or undefined', () => {
    const { rerender } = render(<KeyValueDisplay data={null} />);
    expect(screen.getByTestId('key-value-empty')).toBeInTheDocument();

    rerender(<KeyValueDisplay data={undefined} />);
    expect(screen.getByTestId('key-value-empty')).toBeInTheDocument();
  });
});

describe('stringifyValue', () => {
  it('returns strings verbatim', () => {
    expect(stringifyValue('hello')).toBe('hello');
    expect(stringifyValue('')).toBe('');
  });

  it('stringifies primitives', () => {
    expect(stringifyValue(42)).toBe('42');
    expect(stringifyValue(false)).toBe('false');
    expect(stringifyValue(null)).toBe('null');
    expect(stringifyValue(undefined)).toBe('undefined');
  });

  it('JSON-stringifies structured values', () => {
    expect(stringifyValue({ a: 1 })).toBe('{"a":1}');
    expect(stringifyValue([1, 'two', true])).toBe('[1,"two",true]');
  });

  it('falls back to String() for non-serializable values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // Should not throw; falls back to String(value).
    expect(typeof stringifyValue(circular)).toBe('string');
    // BigInt cannot be JSON-serialized, so it falls back to String(value).
    expect(stringifyValue(BigInt(10))).toBe('10');
  });
});
