/**
 * Authentication service contracts and data models.
 *
 * Covers the AuthService interface plus the credential/token/session data
 * models used by the auth service, session store, and AuthContext.
 * (Requirements 1.2, 1.3, 1.5, 1.6, 11.x)
 */

/**
 * Result of an authentication attempt.
 *
 * On success `token` carries the issued auth token; on failure `error`
 * carries the API-provided failure reason (Requirement 1.4).
 */
export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Handles authentication operations with the ADES Support API.
 */
export interface AuthService {
  login(username: string, password: string): Promise<AuthResult>;
  logout(): void;
  getToken(): string | null;
  isAuthenticated(): boolean;
  isTokenExpired(): boolean;
}

/**
 * Credentials submitted from the login interface (Requirement 1.1).
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * An issued authentication token paired with its expiry.
 */
export interface AuthToken {
  token: string;
  /** Unix timestamp (milliseconds) at which the token expires. */
  expiresAt: number;
}

/**
 * Session data persisted in session storage (Requirement 1.3, 11.5).
 */
export interface SessionData {
  token: string;
  /** Unix timestamp (milliseconds) at which the token expires. */
  expiresAt: number;
  /** Unix timestamp (milliseconds) of the last user activity. */
  lastActivity: number;
}
