# Implementation Plan: RITA Adobe

## Overview

This plan converts the RITA Adobe design into incremental, code-focused tasks. The application is a React 18+ / TypeScript SPA built with Vite, following a layered architecture (Presentation → State → Service → Infrastructure). Tasks are ordered bottom-up: foundational utilities and infrastructure first, then services, state, UI components, pages, and finally integration/wiring. Each task builds on previous ones with no orphaned code. Property-based tests (fast-check) and unit/integration tests are included as optional sub-tasks placed close to the implementation they validate.

All 13 correctness properties from the design are covered by dedicated property-test sub-tasks. The 12 requirements are referenced throughout for traceability.

## Tasks

- [x] 1. Set up project structure, tooling, and core types
  - [x] 1.1 Initialize Vite + React + TypeScript project and testing tooling
    - Scaffold a Vite React-TS project with the directory structure: `src/services`, `src/infrastructure`, `src/context`, `src/components`, `src/pages`, `src/layout`, `src/utils`, `src/types`
    - Install runtime deps: `axios`, `react-router-dom@6`
    - Install dev/test deps: `jest`, `@testing-library/react`, `@testing-library/user-event`, `jest-environment-jsdom`, `fast-check`, `jest-axe`, `ts-jest`
    - Configure Jest (jsdom environment, ts-jest transform) and add an `app config` module exposing the API base URL `https://api-2026-02.ades.support` and external variable base URL `https://var.ctv.ac`
    - _Requirements: 9.4_

  - [x] 1.2 Define core TypeScript interfaces and shared types
    - Create `src/types` modules for service contracts (`AuthService`, `AuthResult`, `AccountService`, `AccountCheckResult`, `Account12hResult`, `Account12hRecord`, `VariableResult`, `ReinviteResult`, `OTPService`, `OTPResult`, `WebSocketService`, `WSMessage`, `ConnectionStatus`)
    - Add data-model types (`LoginCredentials`, `AuthToken`, `SessionData`, `AccountStatus`, `Account12hData`, `VariableData`, `WebSocketMessage`, `MonitorState`, `ValidationResult`)
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.4, 6.2, 7.2_

- [x] 2. Implement email validation utility
  - [x] 2.1 Implement email validation function
    - Create `src/utils/emailValidation` exporting a deterministic `validateEmail(input: string): ValidationResult`
    - Enforce the grammar: local-part of alphanumerics, dots, hyphens, underscores, plus signs; exactly one `@`; domain of alphanumerics, dots, hyphens with at least one dot separating labels
    - Reject empty/whitespace-only input and any input exceeding 254 characters with distinct error messages
    - _Requirements: 8.1, 8.3, 8.5, 8.6_

  - [x] 2.2 Write property test for email validation
    - **Property 1: Email Validation Correctness**
    - **Validates: Requirements 8.1, 8.3, 8.5, 8.6**
    - Generators: valid emails per grammar, malformed emails (missing/multiple `@`, no domain dot, illegal chars), boundary lengths (254 vs 255), empty/whitespace strings; assert accept iff grammar + length + non-empty hold, and repeated calls are deterministic
    - Tag: `Feature: rita-adobe, Property 1: Email validation correctness`

  - [x] 2.3 Write unit tests for email validation edge cases
    - Test specific valid/invalid examples and each distinct error message (required, invalid format, too long)
    - _Requirements: 8.2, 8.5, 8.6_

- [x] 3. Implement session storage infrastructure
  - [x] 3.1 Implement session storage adapter
    - Create `src/infrastructure/sessionStore` to store/retrieve/clear the auth token and expiry in `sessionStorage`
    - Provide `storeToken`, `getToken`, `clearToken`, `getSessionData`, and an `isTokenExpired` helper based on `expiresAt`
    - Handle storage failures by surfacing a boolean/throwing so callers can force a reload
    - _Requirements: 1.3, 11.4, 11.5, 11.7_

  - [x] 3.2 Write property test for session token storage round-trip
    - **Property 2: Session Token Storage Round-Trip**
    - **Validates: Requirements 1.3**
    - Generators: arbitrary token strings including special characters and whitespace; assert `getToken(storeToken(t)) === t`
    - Tag: `Feature: rita-adobe, Property 2: Session token storage round-trip`

- [x] 4. Implement HTTP client infrastructure
  - [x] 4.1 Implement Axios HTTP client with interceptors
    - Create `src/infrastructure/httpClient` configuring an Axios instance with the ADES API base URL and a 30-second default timeout
    - Add a request interceptor that injects the `Authorization` header from the session store when a token exists
    - Add a response interceptor that, on 401, clears the token and triggers redirect-to-login; map network/timeout/4xx/5xx errors to user-facing messages per the design's error table
    - Expose a way to issue requests against the external variable base URL WITHOUT the Authorization header
    - _Requirements: 1.5, 1.6, 2.6, 10.3, 10.4_

  - [x] 4.2 Write property test for token header inclusion
    - **Property 8: Authentication Token Header Inclusion**
    - **Validates: Requirements 1.5**
    - Generators: arbitrary request configs built while a token exists in the session store; assert resulting headers include the token in the `Authorization` header
    - Tag: `Feature: rita-adobe, Property 8: Authentication token header inclusion`

  - [x] 4.3 Write unit tests for 401 handling and error mapping
    - Verify 401 clears token and signals redirect; verify network, timeout, 400, 404, 500 map to the correct messages
    - _Requirements: 1.6, 10.3, 10.4_

- [x] 5. Implement authentication service and route guard
  - [x] 5.1 Implement AuthService
    - Create `src/services/authService` implementing `login` (POST `/ades-support/auth/token`, store token + expiry on success, return API error on failure), `logout` (clear token), `getToken`, `isAuthenticated`, `isTokenExpired`
    - _Requirements: 1.2, 1.3, 1.4, 11.2_

  - [x] 5.2 Implement route-guard decision logic
    - Create `src/utils/routeGuard` exporting a pure `shouldRedirectToLogin(session): boolean` that returns true when no token exists or the token is expired (including post-401 cleared state)
    - _Requirements: 1.6, 11.4, 11.5_

  - [x] 5.3 Write property test for authentication redirect invariant
    - **Property 7: Authentication Redirect Invariant**
    - **Validates: Requirements 1.6, 11.4, 11.5**
    - Generators: arbitrary session states (valid unexpired token, expired token, missing token, post-401 cleared); assert guard returns "redirect" iff no valid unexpired token
    - Tag: `Feature: rita-adobe, Property 7: Authentication redirect invariant`

  - [x] 5.4 Write integration test for auth token endpoint wiring
    - Mock the HTTP client and assert `login` issues a request to `/ades-support/auth/token` and surfaces the API error message on failure
    - _Requirements: 1.2, 1.4_

- [x] 6. Implement account and OTP services
  - [x] 6.1 Implement AccountService
    - Create `src/services/accountService` with `checkAccount` (`/ades-support/account/check`), `getAccount12h` (`/ades-support/account-12h`), `getVariables` (`https://var.ctv.ac/{email}`, external base, no auth header), and `reinvite` (`/ades-support/reinvite/{email}`)
    - Normalize each into its result type, distinguishing success-with-data, success-empty, and error-with-API-message
    - _Requirements: 2.2, 2.4, 3.2, 3.4, 3.5, 4.2, 4.4, 4.5, 5.4, 5.5, 5.6_

  - [x] 6.2 Implement OTPService
    - Create `src/services/otpService` with `readOTP` requesting `/mail/read-otp-gpm?email={email}`, returning the OTP, a no-OTP-found state, or an API error message
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 6.3 Write integration tests for account and OTP endpoint wiring
    - Mock the HTTP client and assert each method targets the correct endpoint/URL and that `getVariables` omits the Authorization header; verify empty-result and error mapping
    - _Requirements: 2.2, 3.2, 4.2, 5.4, 6.2_

- [x] 7. Implement WebSocket service and bounded message queue
  - [x] 7.1 Implement bounded message queue and timestamp formatter
    - Create `src/utils/messageQueue` exposing an append operation that caps the queue at 500, evicting the oldest first while preserving arrival order
    - Add an ISO 8601 (`YYYY-MM-DDTHH:mm:ss`) timestamp formatter used when recording each received message
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 7.2 Write property test for the bounded message queue
    - **Property 3: Bounded WebSocket Message Queue Invariant**
    - **Validates: Requirements 7.1, 7.5**
    - Generators: sequences of 0–1000 messages; assert final length = min(N, 500), retains most-recent 500 in arrival order, oldest evicted first
    - Tag: `Feature: rita-adobe, Property 3: Bounded WebSocket message queue invariant`

  - [x] 7.3 Write property test for message timestamp format
    - **Property 4: WebSocket Message Timestamp Format**
    - **Validates: Requirements 7.4**
    - Generators: arbitrary payloads and receive times; assert appended timestamp matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$` and equals the formatted receive time
    - Tag: `Feature: rita-adobe, Property 4: WebSocket message timestamp format`

  - [x] 7.4 Implement WebSocketService connection management
    - Create `src/services/webSocketService` that connects to `wss://api-2026-02.ades.support/socket.io/?email={email}&EIO=4&transport=websocket`, exposes `connect`, `disconnect` (send close frame), `onMessage`, `onStatusChange`, `getStatus`
    - Enforce a 10-second connect timeout that surfaces an error status; emit connected/disconnected/error transitions; route incoming messages through the bounded queue from 7.1
    - _Requirements: 7.2, 7.3, 7.6, 7.7, 7.8, 7.9_

  - [x] 7.5 Write unit/integration tests for WebSocket lifecycle
    - Use a mock WebSocket and fake timers to verify connect endpoint, 10s connect-timeout error, disconnect close frame, and status transitions
    - _Requirements: 7.2, 7.6, 7.7, 7.9_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement state layer context providers
  - [x] 9.1 Implement NotificationContext
    - Create `src/context/NotificationContext` managing a notifications array with `showSuccess`, `showError`, `showInfo`, and `dismiss`; new notifications are prepended (most-recent-first); success notifications schedule auto-dismiss after 3 seconds
    - _Requirements: 10.2, 10.3, 10.5, 10.6, 10.7_

  - [x] 9.2 Write property test for notification stacking order
    - **Property 11: Notification Stacking Order**
    - **Validates: Requirements 10.7**
    - Generators: arbitrary sequences of notification additions; assert rendered order is most-recent-first
    - Tag: `Feature: rita-adobe, Property 11: Notification stacking order`

  - [x] 9.3 Implement AuthContext with activity tracking
    - Create `src/context/AuthContext` exposing `isAuthenticated`, `token`, `login`, `logout`, `lastActivity`, `updateActivity`; wire to AuthService and session store
    - On logout, close any active WebSocket connection (via WebSocketService) before clearing the token and redirecting within 1s; force page reload if token clear fails
    - Implement a 30-minute inactivity timeout that auto-logs-out
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 11.7_

  - [x] 9.4 Write unit tests for context timing behaviors
    - Use fake timers to verify success-toast auto-dismiss at 3s, logout-within-1s, and 30-minute inactivity auto-logout
    - _Requirements: 10.5, 11.2, 11.6_

- [x] 10. Implement shared input and feedback components
  - [x] 10.1 Implement EmailInput component
    - Create `src/components/EmailInput` using `validateEmail`, debouncing validation feedback to within 500ms of input change, calling `onValidationChange`, enforcing the 254-char max
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [x] 10.2 Write component test for EmailInput validation timing
    - Use fake timers to assert the validation error appears within the 500ms debounce window
    - _Requirements: 8.2_

  - [x] 10.3 Implement ActionButton component
    - Create `src/components/ActionButton` rendering a loading spinner and disabling itself while `loading` is true or `disabled` is set; support `primary`/`secondary`/`danger` variants
    - _Requirements: 8.4, 10.1, 12.2_

  - [x] 10.4 Write property test for action button enablement
    - **Property 6: Action Button Enablement Invariant**
    - **Validates: Requirements 8.4, 10.1, 12.2**
    - Generators: arbitrary email values (valid/invalid) paired with loading booleans; assert button enabled iff (email valid AND not loading)
    - Tag: `Feature: rita-adobe, Property 6: Action button enablement invariant`

  - [x] 10.5 Implement ToastNotification component and container
    - Create `src/components/ToastNotification` and a fixed-position container that consumes NotificationContext, stacks notifications vertically (newest on top), auto-dismisses success after 3s, and provides a manual close button on errors
    - _Requirements: 10.5, 10.6, 10.7, 10.8_

  - [x] 10.6 Implement ConfirmDialog component
    - Create `src/components/ConfirmDialog` modal with title/message/confirm/cancel, focus management, and `onConfirm`/`onCancel` callbacks
    - _Requirements: 5.2, 5.7_

  - [x] 10.7 Write component tests for toast and dialog
    - Verify toast stacking/auto-dismiss/manual-dismiss and ConfirmDialog confirm/cancel callback behavior
    - _Requirements: 10.6, 10.7, 5.7_

- [x] 11. Implement data display and monitoring panels
  - [x] 11.1 Implement ResultPanel component
    - Create `src/components/ResultPanel` rendering title plus loading, error, and success/children states
    - _Requirements: 2.3, 3.3, 4.3, 12.3, 12.4_

  - [x] 11.2 Implement key-value and tabular data display components
    - Create a `KeyValueDisplay` that renders every key and stringified value from a record, and a `DataTable` whose headers cover the union of all field keys across records and renders every field per row; include empty-state messaging
    - _Requirements: 2.3, 3.3, 3.4, 4.3, 4.4_

  - [x] 11.3 Write property test for data display completeness
    - **Property 5: API Response Data Display Completeness**
    - **Validates: Requirements 2.3, 3.3, 4.3**
    - Generators: arbitrary key-value objects and arrays of record objects; assert every key + stringified value appears in key-value output, and table headers cover the union of keys with every field rendered
    - Tag: `Feature: rita-adobe, Property 5: API response data display completeness`

  - [x] 11.4 Implement MonitorPanel component
    - Create `src/components/MonitorPanel` rendering messages with ISO 8601 timestamps, a connected/disconnected status indicator, and the 500-message cap visualization
    - _Requirements: 7.3, 7.4, 7.6_

- [x] 12. Implement layout and navigation
  - [x] 12.1 Implement Header component
    - Create `src/layout/Header` showing the application name "RITA Adobe" and a logout button wired to AuthContext
    - _Requirements: 9.4, 11.1_

  - [x] 12.2 Implement Sidebar navigation
    - Create `src/layout/Sidebar` listing all functions grouped into three sections (Account Operations, Authentication Tools, Real-Time Monitoring) plus Unified Dashboard, highlighting the active item distinctly
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 12.3 Implement MainLayout with route guard and viewport guard
    - Create `src/layout/MainLayout` composing Header, Sidebar, and content area; apply the route guard (redirect to login when unauthenticated/expired) and render a desktop-only message when viewport width is below 1024px
    - _Requirements: 9.5, 9.6, 11.4, 11.5_

  - [x] 12.4 Write component/visual tests for layout
    - Snapshot/assert header content, three-section sidebar with active highlight, fixed toast position, and the sub-1024px desktop-only message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.8_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement authentication and account operation pages
  - [x] 14.1 Implement LoginPage
    - Create `src/pages/LoginPage` with username/password fields, empty-field validation that prevents submission, loading state on submit, and API error display
    - _Requirements: 1.1, 1.4, 1.7_

  - [x] 14.2 Write tests for LoginPage
    - Verify fields render, empty credentials block the request with a validation error, and the API failure reason is shown
    - _Requirements: 1.1, 1.4, 1.7_

  - [x] 14.3 Implement AccountCheckPage
    - Create `src/pages/AccountCheckPage` wiring EmailInput + ActionButton + ResultPanel + KeyValueDisplay to `checkAccount`, with timeout error + retry handling
    - _Requirements: 2.1, 2.3, 2.4, 2.6_

  - [x] 14.4 Implement Account12hPage
    - Create `src/pages/Account12hPage` wiring EmailInput + ActionButton + DataTable to `getAccount12h`, rendering the table with headers and a "no data" empty state
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [x] 14.5 Implement VariablePage
    - Create `src/pages/VariablePage` wiring EmailInput + ActionButton + KeyValueDisplay to `getVariables`, with empty-result and error messaging
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [x] 14.6 Implement OTPPage
    - Create `src/pages/OTPPage` reading OTP via OTPService, displaying the value at ≥18px high-contrast font with a copy-to-clipboard button; success toast auto-dismisses after 3s, copy failure shows an error, no-OTP shows a message
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 14.7 Write tests for account and OTP pages
    - Verify success/empty/error states for check/12h/variable pages and OTP copy success/failure paths
    - _Requirements: 2.4, 3.4, 4.4, 6.4, 6.8_

- [x] 15. Implement reinvite page with confirmation flow
  - [x] 15.1 Implement ReinvitePage
    - Create `src/pages/ReinvitePage` with EmailInput + reinvite ActionButton that opens a ConfirmDialog displaying the exact target email; confirm calls `reinvite` and shows success/error, cancel aborts with no request, invalid email suppresses the dialog
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 15.2 Write property test for confirmation dialog email consistency
    - **Property 9: Confirmation Dialog Email Consistency**
    - **Validates: Requirements 5.2**
    - Generators: arbitrary valid emails; assert triggering reinvite opens a dialog whose text contains exactly that email
    - Tag: `Feature: rita-adobe, Property 9: Confirmation dialog email consistency`

  - [x] 15.3 Write property test for cancel operation state preservation
    - **Property 10: Cancel Operation State Preservation**
    - **Validates: Requirements 5.7**
    - Generators: arbitrary application states (email value, panel contents, form states); assert open-then-cancel leaves state deep-equal to pre-dialog state and issues no reinvite request
    - Tag: `Feature: rita-adobe, Property 10: Cancel operation state preservation`

- [x] 16. Implement real-time monitoring page
  - [x] 16.1 Implement MonitorPage
    - Create `src/pages/MonitorPage` wiring EmailInput + start/disconnect controls to WebSocketService and MonitorPanel; show connect-timeout error with retry, connected/disconnected indicators, and the 500-message bounded queue
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 16.2 Write tests for MonitorPage
    - Verify connect/disconnect flow, status indicator updates, retry on timeout, and message rendering with timestamps
    - _Requirements: 7.3, 7.6, 7.7, 7.9_

- [x] 17. Implement unified account dashboard
  - [x] 17.1 Implement DashboardPage
    - Create `src/pages/DashboardPage` with a single persisted EmailInput, quick-action buttons for all operations, and dedicated result panels (Account Status, 12-Hour Data, Variables, Reinvite Status, OTP, Monitoring); routing each operation result into its panel and replacing prior results
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 17.2 Write property test for dashboard email persistence
    - **Property 12: Dashboard Email Persistence**
    - **Validates: Requirements 12.6**
    - Generators: arbitrary email + arbitrary sequence of operations; assert the email field value remains the entered email throughout
    - Tag: `Feature: rita-adobe, Property 12: Dashboard email persistence`

  - [x] 17.3 Write property test for dashboard panel result replacement
    - **Property 13: Dashboard Panel Result Replacement**
    - **Validates: Requirements 12.5**
    - Generators: arbitrary non-empty sequences of results routed to a panel; assert panel content equals the last result only
    - Tag: `Feature: rita-adobe, Property 13: Dashboard panel result replacement`

- [x] 18. Integrate application and wire routing
  - [x] 18.1 Wire App with providers and router
    - Create `src/App` composing AuthProvider → NotificationProvider → Router with the toast container; define routes for LoginPage and the MainLayout-wrapped pages (Dashboard, AccountCheck, Account12h, Variable, Reinvite, OTP, Monitor) protected by the route guard
    - _Requirements: 1.6, 9.1, 11.4, 11.5_

  - [x] 18.2 Write integration tests for end-to-end flows
    - Mock HTTP/WS clients and verify login → protected route access, 401 → redirect, and dashboard operations routing into panels
    - _Requirements: 1.6, 11.4, 12.3, 12.4_

  - [x] 18.3 Write accessibility tests
    - Run jest-axe on key pages/components and assert ARIA labels on inputs and focus management in the ConfirmDialog
    - _Requirements: 9.1, 10.6_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each task references specific requirement sub-clauses for traceability.
- Checkpoints (tasks 8, 13, 19) ensure incremental validation at natural breaks.
- Property-based tests (fast-check) validate the 13 universal correctness properties; all 13 are covered (P1→2.2, P2→3.2, P3→7.2, P4→7.3, P5→11.3, P6→10.4, P7→5.3, P8→4.2, P9→15.2, P10→15.3, P11→9.2, P12→17.2, P13→17.3).
- Unit, integration, component, and accessibility tests cover timing behaviors, endpoint wiring, UI structure, and example/edge-case states per the design's Testing Strategy.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "7.1", "9.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "4.1", "5.2", "7.2", "7.3", "9.2"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1", "5.3", "6.1", "6.2", "7.4", "10.1", "10.3", "10.5", "10.6", "11.1", "11.2", "11.4"] },
    { "id": 5, "tasks": ["5.4", "6.3", "7.5", "9.3", "10.2", "10.4", "10.7", "11.3"] },
    { "id": 6, "tasks": ["9.4", "12.1", "12.2"] },
    { "id": 7, "tasks": ["12.3", "14.1", "14.3", "14.4", "14.5", "14.6", "15.1", "16.1", "17.1"] },
    { "id": 8, "tasks": ["12.4", "14.2", "14.7", "15.2", "15.3", "16.2", "17.2", "17.3", "18.1"] },
    { "id": 9, "tasks": ["18.2", "18.3"] }
  ]
}
```
