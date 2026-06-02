# Requirements Document

## Introduction

The Adobe Account Portal is an internal web application designed for support teams to manage Adobe Creative Cloud account verification and renewal operations. The portal provides a streamlined interface for checking account status, processing renewals, retrieving OTP codes, reinviting accounts, and monitoring real-time updates via WebSocket connections. The application interfaces with the ADES Support API to perform all account management operations.

## Glossary

- **Portal**: The Adobe Account Portal web application used by support staff
- **Account_Checker**: The component responsible for verifying account status via the `/ades-support/account/check` endpoint
- **Account_Renewer**: The component that processes account renewal operations
- **OTP_Retriever**: The component that fetches one-time passwords from the `/mail/read-otp-gpm` endpoint
- **Reinvite_Handler**: The component that manages account reinvitation via the `/ades-support/reinvite/{email}` endpoint
- **Account_12h_Processor**: The component that handles the 12-hour account operation via `/ades-support/account-12h`
- **WebSocket_Monitor**: The component that maintains real-time WebSocket connections for live updates
- **Token_Manager**: The component that handles authentication token operations via `/ades-support/auth/token`
- **Profile_Card**: The UI component displaying account information including email, team, account type, status, and last update
- **Success_Modal**: A modal dialog displaying successful operation results with user instructions
- **Support_Staff**: Internal employees who use this portal to manage Adobe accounts
- **Account_Type**: Classification of Adobe accounts (e.g., Adobe CC PRO Renew, Available Account)
- **Account_Status**: The current state of an account (e.g., Active, Inactive, Pending)

## Requirements

### Requirement 1: Account Lookup and Check

**User Story:** As a support staff member, I want to check an Adobe account by email, so that I can view the account's current status and information.

#### Acceptance Criteria

1. THE Portal SHALL provide an email input field in the "Check Account" section for account lookup
2. WHEN a valid email address is submitted, THE Account_Checker SHALL send a request to the `/ades-support/account/check` endpoint
3. WHEN the account check succeeds, THE Portal SHALL display the account information in a Profile_Card
4. THE Profile_Card SHALL display the user email address
5. THE Profile_Card SHALL display the team name associated with the account
6. THE Profile_Card SHALL display the Account_Type (e.g., Adobe CC PRO Renew, Available Account)
7. THE Profile_Card SHALL display the Account_Status with a visual indicator
8. THE Profile_Card SHALL display the last update timestamp in the format "HH:mm DD/MM/YYYY"
9. IF the email format is invalid, THEN THE Portal SHALL display a validation error message before submitting the request
10. WHEN the account check fails, THE Portal SHALL display a descriptive error message indicating the failure reason

### Requirement 2: Account Renewal

**User Story:** As a support staff member, I want to renew an Adobe account, so that I can extend the account's subscription for the customer.

#### Acceptance Criteria

1. THE Portal SHALL provide a "Renew Account" button on the Profile_Card for accounts that are eligible for renewal
2. WHEN the "Renew Account" button is clicked, THE Account_Renewer SHALL initiate the renewal process
3. WHILE the renewal is in progress, THE Portal SHALL display a loading indicator on the button
4. WHEN the renewal succeeds, THE Portal SHALL display a Success_Modal with the title "Renewal Successful"
5. THE Success_Modal SHALL display instructions for the user to sign out and sign back in to complete the renewal
6. THE Success_Modal SHALL provide a dismiss action to close the modal
7. WHEN the renewal fails, THE Portal SHALL display an error message indicating the failure reason
8. THE Portal SHALL disable the "Renew Account" button while a renewal operation is in progress

### Requirement 3: OTP Code Retrieval

**User Story:** As a support staff member, I want to retrieve the OTP code for an account, so that I can assist customers with their verification process.

#### Acceptance Criteria

1. THE Portal SHALL provide a "Get OTP Code" button on the Profile_Card
2. WHEN the "Get OTP Code" button is clicked, THE OTP_Retriever SHALL send a request to the `/mail/read-otp-gpm?email={email}` endpoint
3. WHEN the OTP is successfully retrieved, THE Portal SHALL display the OTP code prominently to the user
4. THE Portal SHALL provide a copy-to-clipboard action for the retrieved OTP code
5. WHEN no OTP is available, THE Portal SHALL display a message indicating no OTP was found
6. WHEN the OTP retrieval fails, THE Portal SHALL display a descriptive error message
7. THE Portal SHALL display a note directing users to check OTP at `https://var.ctv.ac/` as an alternative

### Requirement 4: Account Reinvite

**User Story:** As a support staff member, I want to reinvite an Adobe account, so that I can help customers who need a new invitation to join their team.

#### Acceptance Criteria

1. THE Portal SHALL provide a "Reinvite" button on the Profile_Card
2. WHEN the "Reinvite" button is clicked, THE Reinvite_Handler SHALL send a request to the `/ades-support/reinvite/{email}` endpoint
3. WHILE the reinvite operation is in progress, THE Portal SHALL display a loading indicator
4. WHEN the reinvite succeeds, THE Portal SHALL display a success notification message
5. WHEN the reinvite fails, THE Portal SHALL display a descriptive error message indicating the failure reason
6. THE Portal SHALL require confirmation before executing a reinvite action to prevent accidental invocations

### Requirement 5: Account 12-Hour Operation

**User Story:** As a support staff member, I want to perform the 12-hour account operation, so that I can process accounts that require this specific action.

#### Acceptance Criteria

1. THE Portal SHALL provide an "Account 12h" button on the Profile_Card
2. WHEN the "Account 12h" button is clicked, THE Account_12h_Processor SHALL send a request to the `/ades-support/account-12h` endpoint
3. WHILE the operation is in progress, THE Portal SHALL display a loading indicator
4. WHEN the operation succeeds, THE Portal SHALL display a success notification with the operation result
5. WHEN the operation fails, THE Portal SHALL display a descriptive error message

### Requirement 6: Real-Time WebSocket Updates

**User Story:** As a support staff member, I want to receive real-time updates about account operations, so that I can monitor the progress of ongoing processes.

#### Acceptance Criteria

1. WHEN an account is being checked, THE WebSocket_Monitor SHALL establish a WebSocket connection to `wss://api-2026-02.ades.support/socket.io/?email={email}&EIO=4&transport=websocket`
2. WHILE the WebSocket connection is active, THE Portal SHALL display incoming status updates in real-time
3. WHEN a WebSocket message is received, THE Portal SHALL update the Profile_Card status accordingly
4. WHEN the WebSocket connection is lost unexpectedly, THE Portal SHALL display a disconnection notification
5. IF the WebSocket connection fails, THEN THE Portal SHALL attempt to reconnect automatically up to 3 times
6. WHEN all reconnection attempts fail, THE Portal SHALL display an error message with a manual reconnect option

### Requirement 7: Authentication and Token Management

**User Story:** As a support staff member, I want to authenticate with the system, so that I can securely access the account management tools.

#### Acceptance Criteria

1. THE Portal SHALL provide a login interface for support staff authentication
2. WHEN valid credentials are submitted, THE Token_Manager SHALL request an authentication token from the `/ades-support/auth/token` endpoint
3. WHEN a valid token is received, THE Portal SHALL store the token securely for subsequent API requests
4. WHILE a user is authenticated, THE Portal SHALL include the authentication token in all API request headers
5. WHEN authentication fails, THE Portal SHALL display a descriptive error message
6. WHEN the authentication token expires, THE Portal SHALL prompt the user to re-authenticate
7. THE Portal SHALL provide a logout action that clears the stored authentication token

### Requirement 8: Navigation and Layout

**User Story:** As a support staff member, I want a clear and intuitive navigation structure, so that I can easily access different portal functions.

#### Acceptance Criteria

1. THE Portal SHALL display a header with the title "Verification And Renew"
2. THE Portal SHALL provide navigation tabs including "Account Check" and "Blog"
3. THE Portal SHALL highlight the currently active navigation tab
4. THE Portal SHALL display the main content area below the navigation header
5. THE Portal SHALL display a footer with instructions about signing in via Creative Cloud
6. THE Portal SHALL be responsive and functional on desktop screen sizes with a minimum width of 1024 pixels

### Requirement 9: Email Input Validation

**User Story:** As a support staff member, I want email inputs to be validated, so that I can avoid errors from submitting invalid email addresses.

#### Acceptance Criteria

1. THE Portal SHALL validate email format before submitting any API request requiring an email parameter
2. WHEN an invalid email format is entered, THE Portal SHALL display a validation error message immediately
3. THE Portal SHALL accept email addresses conforming to the standard format (local-part@domain.tld)
4. THE Portal SHALL trim whitespace from email input before validation and submission

### Requirement 10: Loading States and Feedback

**User Story:** As a support staff member, I want clear visual feedback on all operations, so that I know the current state of my actions.

#### Acceptance Criteria

1. WHEN an API request is in progress, THE Portal SHALL display a loading indicator on the triggering element
2. WHEN an API request succeeds, THE Portal SHALL display a success notification
3. WHEN an API request fails, THE Portal SHALL display an error notification with details about the failure
4. IF a network error occurs, THEN THE Portal SHALL display a network connectivity error message
5. THE Portal SHALL allow dismissing notification messages by clicking a close button or after a timeout of 5 seconds

### Requirement 11: Action Button States

**User Story:** As a support staff member, I want action buttons to reflect their current state, so that I understand what actions are available.

#### Acceptance Criteria

1. THE Portal SHALL display action buttons ("Renew Account", "Get OTP Code", "Reinvite", "Account 12h") only when an account is loaded
2. WHILE an operation is in progress, THE Portal SHALL disable the corresponding action button
3. WHEN an operation completes, THE Portal SHALL re-enable the corresponding action button
4. THE Portal SHALL visually distinguish between enabled and disabled button states
5. THE Portal SHALL display a loading spinner inside buttons during their respective operations

### Requirement 12: External OTP Verification Link

**User Story:** As a support staff member, I want quick access to the external OTP verification page, so that I can verify OTP codes through an alternative method.

#### Acceptance Criteria

1. THE Portal SHALL display a note about checking OTP at the external URL `https://var.ctv.ac/`
2. THE Portal SHALL provide a clickable link that opens `https://var.ctv.ac/{email}` in a new browser tab
3. WHEN the link is clicked, THE Portal SHALL substitute the current account email into the URL
