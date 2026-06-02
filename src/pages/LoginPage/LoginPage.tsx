import { useId, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { ActionButton } from '../../components/ActionButton';
import { ROUTE_PATHS } from '../../layout/Sidebar/Sidebar';
import './LoginPage.css';

/**
 * Login interface for support staff (design "LoginPage", task 14.1).
 *
 * Behaviour:
 *  - Renders username and password input fields (Requirement 1.1).
 *  - Empty-field validation: if either field is empty when submission is
 *    attempted, a validation error is shown and the authentication request is
 *    prevented (Requirement 1.7).
 *  - On a valid submit the form enters a loading state (the submit
 *    {@link ActionButton} shows a spinner and is disabled) until
 *    {@link useAuth}'s `login` resolves.
 *  - When authentication fails, the API-provided failure reason exposed by the
 *    auth context (`loginError`) is displayed (Requirement 1.4).
 */

/** The heading shown above the login form. */
export const LOGIN_TITLE = 'RITA Adobe';

/** Validation message shown when the username field is empty (Requirement 1.7). */
export const USERNAME_REQUIRED_ERROR = 'Username is required';

/** Validation message shown when the password field is empty (Requirement 1.7). */
export const PASSWORD_REQUIRED_ERROR = 'Password is required';

export function LoginPage() {
  const { login, loginError, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState<string | undefined>(
    undefined,
  );
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);

  const usernameId = useId();
  const passwordId = useId();
  const usernameErrorId = useId();
  const passwordErrorId = useId();
  const apiErrorId = useId();

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();

    // Empty-field validation runs before any request is issued so that a blank
    // username or password can never reach the authentication endpoint
    // (Requirement 1.7).
    const nextUsernameError =
      username.trim().length === 0 ? USERNAME_REQUIRED_ERROR : undefined;
    const nextPasswordError =
      password.trim().length === 0 ? PASSWORD_REQUIRED_ERROR : undefined;

    setUsernameError(nextUsernameError);
    setPasswordError(nextPasswordError);

    if (nextUsernameError !== undefined || nextPasswordError !== undefined) {
      return;
    }

    setSubmitting(true);
    try {
      await login(username, password);
    } finally {
      setSubmitting(false);
    }
  };

  // Once authenticated, leave the login interface for the dashboard. Rendered
  // as a redirect so a logged-in user never sits on `/login` (task 18.1). In
  // the router-less component tests `isAuthenticated` stays false, so this is
  // inert there.
  if (isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.dashboard} replace />;
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">{LOGIN_TITLE}</h1>
        <form
          className="login-page__form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="login-page__field">
            <label className="login-page__label" htmlFor={usernameId}>
              Username
            </label>
            <input
              id={usernameId}
              className="login-page__input"
              type="text"
              autoComplete="username"
              value={username}
              disabled={submitting}
              aria-invalid={usernameError !== undefined}
              aria-describedby={
                usernameError !== undefined ? usernameErrorId : undefined
              }
              onChange={(event) => setUsername(event.target.value)}
            />
            {usernameError !== undefined && (
              <span
                id={usernameErrorId}
                role="alert"
                className="login-page__field-error"
              >
                {usernameError}
              </span>
            )}
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor={passwordId}>
              Password
            </label>
            <input
              id={passwordId}
              className="login-page__input"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={submitting}
              aria-invalid={passwordError !== undefined}
              aria-describedby={
                passwordError !== undefined ? passwordErrorId : undefined
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            {passwordError !== undefined && (
              <span
                id={passwordErrorId}
                role="alert"
                className="login-page__field-error"
              >
                {passwordError}
              </span>
            )}
          </div>

          {loginError !== null && (
            <div
              id={apiErrorId}
              role="alert"
              className="login-page__api-error"
            >
              {loginError}
            </div>
          )}

          <div className="login-page__actions">
            <ActionButton
              label="Log in"
              onClick={handleSubmit}
              loading={submitting}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
