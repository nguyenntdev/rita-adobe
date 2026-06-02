/**
 * Barrel module re-exporting all shared types.
 *
 * Lets consumers import from a single path, e.g.
 * `import type { AuthService, ValidationResult } from '../types';`
 */
export type { ValidationResult, EmailValidationRules } from './validation';

export type {
  AuthService,
  AuthResult,
  LoginCredentials,
  AuthToken,
  SessionData,
} from './auth';

export type {
  AccountService,
  AccountCheckResult,
  Account12hResult,
  Account12hRecord,
  VariableResult,
  ReinviteResult,
  AccountStatus,
  Account12hData,
  VariableData,
} from './account';

export type { OTPService, OTPResult } from './otp';

export type {
  WebSocketService,
  WSMessage,
  ConnectionStatus,
  WebSocketMessage,
  MonitorState,
} from './websocket';
