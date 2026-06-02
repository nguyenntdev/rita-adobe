# Requirements Document

## Introduction

RITA Adobe is an internal web application that serves as a frontend interface for the ADES Support API. The tool enables internal support staff to perform account management operations, authentication handling, reinvite processes, OTP retrieval, and real-time monitoring through WebSocket connections. This application is designed exclusively for internal use by support personnel and prioritizes functionality and usability over public-facing aesthetics.

## Glossary

- **RITA_Adobe**: The internal web application frontend that support staff interact with
- **ADES_API**: The backend service at `api-2026-02.ades.support` providing account and authentication operations
- **Account_Checker**: The component responsible for verifying account status via the `/ades-support/account/check` endpoint
- **Token_Manager**: The component that handles authentication token operations via the `/ades-support/auth/token` endpoint
- **Reinvite_Handler**: The component that manages account reinvitation processes via the `/ades-support/reinvite/{email}` endpoint
- **OTP_Reader**: The component that retrieves one-time passwords via the `/mail/read-otp-gpm` endpoint
- **WebSocket_Monitor**: The component that maintains real-time connections via the WebSocket endpoint and displays live updates
- **Account_12h_Viewer**: The component that displays account information from the `/ades-support/account-12h` endpoint
- **Variable_Fetcher**: The component that retrieves variable/data from the `var.ctv.ac/{email}` endpoint
- **Support_Staff**: Internal employees who use this tool to assist with account-related tasks
- **Email_Input**: A validated email address field used to identify accounts for API operations

## Requirements

### Requirement 1: User Authentication

**User Story:** As a support staff member, I want to authenticate with the system, so that I can securely access the support tools.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a login interface with username and password input fields for support staff authentication
2. WHEN valid credentials are submitted, THE Token_Manager SHALL request an authentication token from the `/ades-support/auth/token` endpoint
3. WHEN a valid token is received, THE RITA_Adobe SHALL store the token in session storage for subsequent API requests
4. IF the `/ades-support/auth/token` endpoint returns an error response, THEN THE RITA_Adobe SHALL display an error message indicating the authentication failure reason returned by the API
5. WHILE a user is authenticated, THE RITA_Adobe SHALL include the authentication token in all API request headers
6. WHEN an API request returns a 401 Unauthorized response, THE RITA_Adobe SHALL clear the stored token from session storage and redirect the user to the login interface
7. IF the username or password field is empty when submission is attempted, THEN THE RITA_Adobe SHALL display a validation error and prevent the authentication request

### Requirement 2: Account Status Check

**User Story:** As a support staff member, I want to check account status, so that I can verify account information for customers.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide an email input field for account status lookup that accepts a maximum of 254 characters
2. WHEN a valid email address is entered and the check action is triggered, THE Account_Checker SHALL send a request to the `/ades-support/account/check` endpoint
3. WHEN the account check succeeds, THE RITA_Adobe SHALL display the account status information returned by the API in a labeled key-value format showing all fields returned by the API response
4. WHEN the account check fails, THE RITA_Adobe SHALL display an error message indicating the failure reason returned by the API
5. IF the email format is invalid, THEN THE RITA_Adobe SHALL display a validation error message and prevent the API request
6. IF the account check request does not receive a response within 30 seconds, THEN THE RITA_Adobe SHALL display a timeout error message and allow the user to retry the request

### Requirement 3: Account 12-Hour Data Retrieval

**User Story:** As a support staff member, I want to view account 12-hour data, so that I can see recent account activity and status within the last 12 hours.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide an email input field and a retrieval action button to request account 12-hour data
2. WHEN a valid email address is entered and the retrieval action is triggered, THE Account_12h_Viewer SHALL send a request to the `/ades-support/account-12h` endpoint with the specified email
3. WHEN the data is successfully retrieved, THE RITA_Adobe SHALL display the account 12-hour information in a tabular format with column headers identifying each data field
4. WHEN the request succeeds but no account activity exists for the 12-hour period, THE RITA_Adobe SHALL display a message indicating no data is available for the specified account
5. WHEN the request fails, THE RITA_Adobe SHALL display an error message indicating the failure reason returned by the API
6. IF the email format is invalid, THEN THE RITA_Adobe SHALL display a validation error and prevent the API request

### Requirement 4: Variable Data Retrieval

**User Story:** As a support staff member, I want to retrieve variable data for an account, so that I can access additional account-related configuration information.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide an email input field and a fetch action button to retrieve variable data for a specified email address
2. WHEN variable data is requested for an email, THE Variable_Fetcher SHALL send a request to the `https://var.ctv.ac/{email}` endpoint
3. WHEN the variable data is successfully retrieved and contains data, THE RITA_Adobe SHALL display the data in a structured key-value format
4. WHEN the variable data response contains no data or an empty result, THE RITA_Adobe SHALL display a message indicating no variable data is available for the specified email
5. WHEN the request fails, THE RITA_Adobe SHALL display an error message indicating the failure reason returned by the endpoint

### Requirement 5: Account Reinvite

**User Story:** As a support staff member, I want to reinvite an account, so that I can help customers who need a new invitation email.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a reinvite action button associated with the currently entered email address in the Email_Input field
2. WHEN a reinvite action is triggered, THE RITA_Adobe SHALL display a confirmation dialog that identifies the email address to be reinvited and requests user confirmation to proceed
3. IF the email format is invalid when the reinvite action is triggered, THEN THE RITA_Adobe SHALL display a validation error and prevent the confirmation dialog from appearing
4. WHEN the user confirms the reinvite action, THE Reinvite_Handler SHALL send a request to the `/ades-support/reinvite/{email}` endpoint
5. WHEN the reinvite succeeds, THE RITA_Adobe SHALL display a success confirmation message indicating the reinvite was sent to the specified email address
6. WHEN the reinvite fails, THE RITA_Adobe SHALL display a descriptive error message indicating the failure reason
7. WHEN the user cancels the confirmation dialog, THE RITA_Adobe SHALL abort the reinvite operation and return to the previous state without changes

### Requirement 6: OTP Reading

**User Story:** As a support staff member, I want to read OTPs for accounts, so that I can assist customers with authentication issues.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide an interface to read OTPs for a specified email address
2. WHEN an OTP read is requested, THE OTP_Reader SHALL send a request to the `/mail/read-otp-gpm?email={email}` endpoint
3. WHEN the OTP is successfully retrieved, THE RITA_Adobe SHALL display the OTP value in a dedicated panel using a minimum font size of 18 pixels with high contrast against the background
4. WHEN no OTP is available for the email, THE RITA_Adobe SHALL display a message indicating no OTP was found
5. WHEN the OTP request fails, THE RITA_Adobe SHALL display an error toast notification containing the failure reason returned by the API
6. THE RITA_Adobe SHALL provide a copy-to-clipboard button adjacent to the retrieved OTP value
7. WHEN the copy action succeeds, THE RITA_Adobe SHALL display a success toast notification that auto-dismisses after 3 seconds
8. IF the copy-to-clipboard action fails, THEN THE RITA_Adobe SHALL display an error message indicating the clipboard operation was unsuccessful

### Requirement 7: Real-Time WebSocket Monitoring

**User Story:** As a support staff member, I want to monitor real-time updates for an account, so that I can see live account activity and status changes.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a real-time monitoring panel for WebSocket updates that displays a maximum of 500 messages
2. WHEN monitoring is initiated for an email, THE WebSocket_Monitor SHALL establish a WebSocket connection to `wss://api-2026-02.ades.support/socket.io/?email={email}&EIO=4&transport=websocket` within 10 seconds
3. WHILE the WebSocket connection is active, THE RITA_Adobe SHALL display a connected status indicator
4. WHEN a WebSocket message is received, THE RITA_Adobe SHALL append the message to the monitoring panel with a timestamp in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
5. WHEN the message limit of 500 is reached, THE RITA_Adobe SHALL remove the oldest message before appending the new message
6. WHEN the WebSocket connection is closed by the server or due to network failure, THE RITA_Adobe SHALL display a disconnection notification and update the status indicator to disconnected
7. IF the WebSocket connection fails to establish within 10 seconds, THEN THE RITA_Adobe SHALL display an error message indicating connection timeout and provide a retry action
8. THE RITA_Adobe SHALL provide a disconnect button to manually close the WebSocket connection
9. WHEN the disconnect button is clicked, THE WebSocket_Monitor SHALL send a close frame to the server and close the active WebSocket connection, then update the status indicator to disconnected

### Requirement 8: Email Input Validation

**User Story:** As a support staff member, I want email inputs to be validated, so that I can avoid errors from invalid email formats.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL validate email format before submitting any API request that requires an email parameter
2. WHEN an invalid email format is entered, THE RITA_Adobe SHALL display a validation error message within 500 milliseconds of the input change
3. THE RITA_Adobe SHALL accept email addresses where the local-part contains alphanumeric characters, dots, hyphens, underscores, and plus signs, followed by exactly one @ symbol, followed by a domain containing alphanumeric characters, dots, and hyphens with at least one dot separating domain labels
4. WHILE an email input contains an invalid format, THE RITA_Adobe SHALL disable the associated action buttons
5. THE RITA_Adobe SHALL reject email addresses exceeding 254 characters in total length
6. IF an email input field is empty, THEN THE RITA_Adobe SHALL display a validation error indicating that an email address is required

### Requirement 9: Navigation and Layout

**User Story:** As a support staff member, I want a clear navigation structure, so that I can easily access different support functions.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a sidebar navigation menu with access to all support functions: Account Status Check, Account 12-Hour Data, Variable Data, Reinvite, OTP Reading, Real-Time Monitoring, and Unified Dashboard
2. THE RITA_Adobe SHALL organize navigation items into three sections: Account Operations (Account Status Check, Account 12-Hour Data, Variable Data, Reinvite), Authentication Tools (OTP Reading), and Real-Time Monitoring (WebSocket Monitor)
3. WHEN a user navigates to a section, THE RITA_Adobe SHALL display the active section's navigation item with a distinct background color or border that differentiates it from inactive items
4. THE RITA_Adobe SHALL display the application name "RITA Adobe" in the header
5. THE RITA_Adobe SHALL render all interface elements without horizontal scrolling when the viewport width is 1024 pixels or greater
6. IF the viewport width is less than 1024 pixels, THEN THE RITA_Adobe SHALL display a message indicating that the application is optimized for desktop screens with a minimum width of 1024 pixels

### Requirement 10: Error Handling and User Feedback

**User Story:** As a support staff member, I want clear feedback on all operations, so that I know whether actions succeeded or failed.

#### Acceptance Criteria

1. WHEN an API request is in progress, THE RITA_Adobe SHALL display a loading spinner on the associated action button and disable the button until the request completes
2. WHEN an API request succeeds, THE RITA_Adobe SHALL display a success toast notification indicating the operation type that completed
3. WHEN an API request fails, THE RITA_Adobe SHALL display an error toast notification containing the operation type that failed and the error message returned by the API
4. IF a network connectivity error occurs, THEN THE RITA_Adobe SHALL display a network error message suggesting the user check their connection
5. THE RITA_Adobe SHALL automatically dismiss success notifications after 3 seconds
6. THE RITA_Adobe SHALL allow manual dismissal of error notifications via a close button on the notification
7. WHEN multiple notifications occur simultaneously, THE RITA_Adobe SHALL stack notifications vertically, displaying the most recent notification at the top
8. THE RITA_Adobe SHALL display all toast notifications in a consistent screen position

### Requirement 11: Session Management

**User Story:** As a support staff member, I want my session to be managed securely, so that unauthorized users cannot access the tool.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a logout button in the application header
2. WHEN the user clicks the logout button, THE RITA_Adobe SHALL clear the authentication token from session storage and redirect to the login interface within 1 second
3. WHEN the user logs out, THE WebSocket_Monitor SHALL close any active WebSocket connections before the redirect occurs
4. WHILE no authentication token exists in session storage or the stored token has expired, THE RITA_Adobe SHALL redirect users to the login interface
5. WHEN the application loads, THE RITA_Adobe SHALL verify that an authentication token exists in session storage and has not expired before displaying the main interface
6. IF the user has no interaction with the application for 30 minutes, THEN THE RITA_Adobe SHALL automatically log out the user and redirect to the login interface
7. IF clearing the authentication token from session storage fails during logout, THEN THE RITA_Adobe SHALL force a page reload to ensure the session is terminated

### Requirement 12: Unified Account Dashboard

**User Story:** As a support staff member, I want a unified view of account information, so that I can see all relevant data for an account in one place.

#### Acceptance Criteria

1. THE RITA_Adobe SHALL provide a dashboard view containing an email input field and operation result panels for: Account Status, 12-Hour Data, Variables, Reinvite Status, OTP, and Monitoring
2. WHEN an email is entered in the dashboard, THE RITA_Adobe SHALL enable quick-action buttons for all account operations: Check Status, View 12h Data, Get Variables, Reinvite, Read OTP, and Start Monitoring
3. WHEN an operation completes successfully, THE RITA_Adobe SHALL display the operation result in the corresponding dedicated panel within the dashboard
4. WHEN an operation fails, THE RITA_Adobe SHALL display the error message in the corresponding panel within the dashboard
5. WHEN a new operation is triggered for the same panel, THE RITA_Adobe SHALL replace the previous result with the new operation result
6. THE RITA_Adobe SHALL persist the entered email in the dashboard input field across different operations within the same session
