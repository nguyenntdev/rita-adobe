import './Header.css';

/**
 * Application header.
 *
 * Displays the application name "RITA Adobe" (Requirement 9.4). The app no
 * longer has a login gate, so there is no logout control.
 */

/** The application name shown in the header (Requirement 9.4). */
export const APP_NAME = 'RITA Adobe';

/**
 * The top application header. Renders the application name.
 */
export function Header() {
  return (
    <header className="header">
      <span className="header__brand">{APP_NAME}</span>
    </header>
  );
}

export default Header;
