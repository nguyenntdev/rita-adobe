import { cleanup, render, screen } from '@testing-library/react';
import { Header, APP_NAME } from './Header';

/**
 * Component tests for the Header.
 *
 * Covers Requirement 9.4: the application name "RITA Adobe" is displayed in the
 * header. The app no longer has a login gate, so there is no logout control.
 */

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('displays the application name "RITA Adobe" (Req 9.4)', () => {
    render(<Header />);

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText('RITA Adobe')).toBeInTheDocument();
  });

  it('does not render a logout button (no auth gate)', () => {
    render(<Header />);

    expect(
      screen.queryByRole('button', { name: 'Logout' }),
    ).not.toBeInTheDocument();
  });
});
