import { cleanup, render, screen } from '@testing-library/react';
import { ResultPanel } from './ResultPanel';

/**
 * Component tests for ResultPanel.
 *
 * Covers the three mutually exclusive states (loading, error, success/children)
 * and the always-present title.
 *
 * Requirements: 2.3, 3.3, 4.3, 12.3, 12.4
 */
describe('ResultPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('always renders the title', () => {
    render(
      <ResultPanel title="Account Status">
        <p>content</p>
      </ResultPanel>,
    );

    expect(
      screen.getByRole('heading', { name: 'Account Status' }),
    ).not.toBeNull();
  });

  it('renders children in the success state', () => {
    render(
      <ResultPanel title="Variables">
        <span data-testid="result-body">key: value</span>
      </ResultPanel>,
    );

    expect(screen.getByTestId('result-body').textContent).toBe('key: value');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders a loading indicator and hides children when loading', () => {
    render(
      <ResultPanel title="12-Hour Data" loading>
        <span data-testid="result-body">should not be visible</span>
      </ResultPanel>,
    );

    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.queryByTestId('result-body')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the error message and hides children when error is set', () => {
    render(
      <ResultPanel title="Account Status" error="Account not found">
        <span data-testid="result-body">should not be visible</span>
      </ResultPanel>,
    );

    expect(screen.getByRole('alert').textContent).toBe('Account not found');
    expect(screen.queryByTestId('result-body')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('prioritises loading over an error when both are provided', () => {
    render(
      <ResultPanel title="Account Status" loading error="stale error">
        <span data-testid="result-body">content</span>
      </ResultPanel>,
    );

    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('result-body')).toBeNull();
  });

  it('treats an empty error string as no error and shows children', () => {
    render(
      <ResultPanel title="Variables" error="">
        <span data-testid="result-body">content</span>
      </ResultPanel>,
    );

    expect(screen.getByTestId('result-body')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
