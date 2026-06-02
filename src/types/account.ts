/**
 * Account service contracts and data models.
 *
 * Covers the AccountService interface and its per-operation result types, plus
 * the data models used to render account status, 12-hour data, and variables.
 * (Requirements 2.x, 3.x, 4.x, 5.x)
 */

/**
 * Result of an account status check (Requirement 2.3, 2.4).
 *
 * `data` holds the dynamic key-value fields returned by the API on success.
 */
export interface AccountCheckResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * A single record from the 12-hour data endpoint.
 *
 * Fields are dynamic; the table renderer derives columns from the union of keys
 * across all records (Requirement 3.3).
 */
export interface Account12hRecord {
  [key: string]: unknown;
}

/**
 * Result of a 12-hour data retrieval (Requirement 3.3, 3.4, 3.5).
 *
 * An empty `data` array represents the "no activity" state.
 */
export interface Account12hResult {
  success: boolean;
  data?: Account12hRecord[];
  error?: string;
}

/**
 * Result of a variable data fetch (Requirement 4.3, 4.4, 4.5).
 */
export interface VariableResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Result of a reinvite operation (Requirement 5.5, 5.6).
 */
export interface ReinviteResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Manages account-related API operations.
 */
export interface AccountService {
  checkAccount(email: string): Promise<AccountCheckResult>;
  getAccount12h(email: string): Promise<Account12hResult>;
  getVariables(email: string): Promise<VariableResult>;
  reinvite(email: string): Promise<ReinviteResult>;
}

/**
 * Account status data model (Requirement 2.3).
 *
 * Includes the queried email and status plus any dynamic fields the API
 * returns.
 */
export interface AccountStatus {
  email: string;
  status: string;
  /** Dynamic fields from the API. */
  [key: string]: unknown;
}

/**
 * 12-hour data model with retrieval metadata (Requirement 3.3).
 */
export interface Account12hData {
  records: Account12hRecord[];
  /** ISO 8601 timestamp of when the data was retrieved. */
  retrievedAt: string;
}

/**
 * Variable data model (Requirement 4.3).
 */
export interface VariableData {
  email: string;
  variables: Record<string, unknown>;
}
