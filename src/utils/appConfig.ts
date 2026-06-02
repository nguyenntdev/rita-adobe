/**
 * Application configuration.
 *
 * Centralizes the base URLs used across the application so that service and
 * infrastructure modules do not hard-code endpoints. The ADES Support API is
 * the primary backend; the variable service is an external endpoint that must
 * be called WITHOUT the Authorization header (see Requirement 4.2).
 */
export interface AppConfig {
  /** Base URL for the ADES Support API. */
  readonly apiBaseUrl: string;
  /** Base URL for the external variable/data service. */
  readonly variableBaseUrl: string;
  /** Default request timeout in milliseconds (Requirement 2.6). */
  readonly requestTimeoutMs: number;
}

export const appConfig: AppConfig = {
  apiBaseUrl: 'https://api-2026-02.ades.support',
  variableBaseUrl: 'https://var.ctv.ac',
  requestTimeoutMs: 30_000,
};
