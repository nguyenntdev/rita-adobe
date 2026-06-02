import { useAuth } from '../../context/AuthContext';
import { ActionButton } from '../../components/ActionButton';
import './Header.css';

/**
 * Application header.
 *
 * Implements:
 *  - Requirement 9.4: displays the application name "RITA Adobe".
 *  - Requirement 11.1: provides a logout button in the header, wired to the
 *    {@link useAuth} context's `logout` (which closes any active WebSocket,
 *    clears the session token, and redirects to the login interface).
 */

/** The application name shown in the header (Requirement 9.4). */
export const APP_NAME = 'RITA Adobe';

/**
 * The top application header. Renders the application name and a logout button
 * bound to the auth context. Must be rendered within an `AuthProvider`.
 */
export function Header() {
  const { logout } = useAuth();

  return (
    <header className="header">
      <span className="header__brand">{APP_NAME}</span>
      <div className="header__actions">
        <ActionButton label="Logout" onClick={logout} variant="secondary" />
      </div>
    </header>
  );
}

export default Header;
