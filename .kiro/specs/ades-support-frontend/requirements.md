# Requirements Document

## Introduction

The ADES Support Frontend is an internal web application that provides support staff with a clean, efficient interface for interacting with the ADES Support API. The application enables account management, authentication handling, reinvite operations, OTP reading, and real-time monitoring through WebSocket connections. This tool is designed exclusively for internal use by support personnel.

## Glossary

- **Frontend**: The web-based user interface application that support staff interact with
- **API**: The ADES Support backend service providing account and authentication operations
- **Account_Checker**: The component responsible for verifying account status via the account check endpoint
- **Token_Manager**: The component that handles authentication token operations
- **Reinvite_Handler**: The component that manages account reinvitation processes
- **OTP_Reader**: The component that retrieves one-time passwords for accounts
- **WebSocket_Monitor**: The component that maintains real-time connections and displays live updates
- **Account_12h_Viewer**: The component that displays account information from the 12-hour endpoint
- **Variable_Fetcher**: The component that retrieves variable/data from the external endpoint
- **Support_Staff**: Internal employees who use this tool to assist with account-related tasks
- **Email_Input**: A validated email address field used to identify accounts

## Requirements

### Requirement 1: User Authentication

**User Story:** As a support staff member, I want to authenticate with the system, so that I can securely access the support tools.

#### Acceptance Criteria

1. THE Frontend SHALL provide a login interface for support staff authentication
2. WHEN valid credentials are submitted, THE Token_Manager SHALL request an authentication token from the `/ades-support/auth/token` endpoint
3. WHEN a valid token is received, THE Frontend SHALL store the token securely for subsequent API requests
4. WHEN authentication fails, THE Frontend SHALL display a descriptive error message to the user
5. WHILE a user is authenticated, THE Frontend SHALL include the authentication token in all API requests
6. WHEN the authentication token expires, THE Frontend SHALL prompt the user to re-authenticate

### Requirement 2: Account Check

**User Story:** As a support staff member, I want to check account status, so that I can verify account information for customers.

#### Acceptance Criteria

1. THE Frontend SHALL provide an email input field for account lookup
2. WHEN a valid email address is entered and submitted, THE Account_Checker SHALL send a request to the `/ades-support/account/check` endpoint
3. WHEN the account check succeeds, THE Frontend SHALL display the account status information returned by the API
4. WHEN the account check fails, THE Frontend SHALL display a descriptive error message indicating the failure reason
5. IF the email format is invalid, THEN THE Frontend SHALL display a validation error before submitting the request

### Requirement 3: Account 12-Hour Data

**User Story:** As a support staff member, I want to view account 12-hour data, so that I can see recent account activity and status.

#### Acceptance Criteria

1. THE Frontend SHALL provide an interface to retrieve account 12-hour data
2. WHEN the account 12-hour data is requested, THE Account_12h_Viewer SHALL send a request to the `/ades-support/account-12h` endpoint
3. WHEN the data is successfully retrieved, THE Frontend SHALL display the account 12-hour information in a readable format
4. WHEN the request fails, THE Frontend SHALL display a descriptive error message

### Requirement 4: Variable Data Retrieval

**User Story:** As a support staff member, I want to retrieve variable data for an account, so that I can access additional account-related information.

#### Acceptance Criteria

1. THE Frontend SHALL provide an interface to fetch variable data for a specified email
2. WHEN variable data is requested for an email, THE Variable_Fetcher SHALL send a request to the `var.ctv.ac` endpoint with the email parameter
3. WHEN the variable data is successfully retrieved, THE Frontend SHALL display the data in a structured format
4. WHEN the request fails, THE Frontend SHALL display a descriptive error message

### Requirement 5: Account Reinvite

**User Story:** As a support staff member, I want to reinvite an account, so that I can help customers who need a new invitation.

#### Acceptance Criteria

1. THE Frontend SHALL provide a reinvite action for a specified email address
2. WHEN a reinvite is requested, THE Reinvite_Handler SHALL send a request to the `/ades-support/reinvite/{email}` endpoint
3. WHEN the reinvite succeeds, THE Frontend SHALL display a success confirmation message
4. WHEN the reinvite fails, THE Frontend SHALL display a descriptive error message indicating the failure reason
5. THE Frontend SHALL require confirmation before executing a reinvite action to prevent accidental invocations

### Requirement 6: OTP Reading

**User Story:** As a support staff member, I want to read OTPs for accounts, so that I can assist customers with authentication issues.

#### Acceptance Criteria

1. THE Frontend SHALL provide an interface to read OTPs for a specified email address
2. WHEN an OTP read is requested, THE OTP_Reader SHALL send a request to the `/mail/read-otp-gpm` endpoint with the email parameter
3. WHEN the OTP is successfully retrieved, THE Frontend SHALL display the OTP value prominently
4. WHEN no OTP is available, THE Frontend SHALL display a message indicating no OTP was found
5. WHEN the OTP request fails, THE Frontend SHALL display a descriptive error message
6. THE Frontend SHALL provide a copy-to-clipboard action for the retrieved OTP

### Requirement 7: Real-Time WebSocket Monitoring

**User Story:** As a support staff member, I want to monitor real-time updates, so that I can see live account activity and status changes.

#### Acceptance Criteria

1. THE Frontend SHALL provide a real-time monitoring panel for WebSocket updates
2. WHEN monitoring is initiated for an email, THE WebSocket_Monitor SHALL establish a WebSocket connection to the `wss://api-2026-02.ades.support/socket.io/` endpoint with the email parameter
3. WHILE the WebSocket connection is active, THE Frontend SHALL display incoming messages in real-time
4. WHEN a WebSocket message is received, THE Frontend SHALL append the message to the monitoring panel with a timestamp
5. WHEN the WebSocket connection is lost, THE Frontend SHALL display a disconnection notification
6. IF the WebSocket connection fails, THEN THE Frontend SHALL provide a reconnect action
7. THE Frontend SHALL provide a clear action to close the WebSocket connection

### Requirement 8: Email Input Validation

**User Story:** As a support staff member, I want email inputs to be validated, so that I can avoid errors from invalid email formats.

#### Acceptance Criteria

1. THE Frontend SHALL validate email format before submitting any API request that requires an email parameter
2. WHEN an invalid email format is entered, THE Frontend SHALL display a validation error message
3. THE Frontend SHALL accept email addresses conforming to standard email format (local-part@domain)

### Requirement 9: Navigation and Layout

**User Story:** As a support staff member, I want a clear navigation structure, so that I can easily access different support functions.

#### Acceptance Criteria

1. THE Frontend SHALL provide a navigation menu with access to all support functions
2. THE Frontend SHALL organize functions into logical sections: Account Management, Authentication, and Monitoring
3. THE Frontend SHALL display the currently active section clearly
4. THE Frontend SHALL be responsive and usable on desktop screen sizes

### Requirement 10: Error Handling and Feedback

**User Story:** As a support staff member, I want clear feedback on all operations, so that I know whether actions succeeded or failed.

#### Acceptance Criteria

1. WHEN an API request is in progress, THE Frontend SHALL display a loading indicator
2. WHEN an API request succeeds, THE Frontend SHALL display a success notification
3. WHEN an API request fails, THE Frontend SHALL display an error notification with the error details
4. IF a network error occurs, THEN THE Frontend SHALL display a network connectivity error message
5. THE Frontend SHALL allow dismissing notification messages

### Requirement 11: Session Management

**User Story:** As a support staff member, I want my session to be managed securely, so that unauthorized users cannot access the tool.

#### Acceptance Criteria

1. THE Frontend SHALL provide a logout action that clears the authentication token
2. WHEN the user logs out, THE Frontend SHALL redirect to the login interface
3. WHEN the user logs out, THE WebSocket_Monitor SHALL close any active WebSocket connections
4. WHILE no valid authentication token exists, THE Frontend SHALL redirect unauthenticated users to the login interface
