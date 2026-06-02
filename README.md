# RITA Adobe

Internal web application that provides ADES support staff with a single interface for account management, authentication tooling, OTP retrieval, and real-time monitoring against the ADES Support API.

> Internal tooling. Optimized for desktop (minimum 1024px viewport). Not intended for public use.

## Features

- **Authentication** — token-based login/logout with session storage, automatic 401 handling, and a 30-minute inactivity timeout.
- **Account Status Check** — look up an account and view all returned fields.
- **Account 12-Hour Data** — recent activity rendered as a table.
- **Variable Data** — fetch configuration variables from the external variable service.
- **Reinvite** — send a new invitation, gated behind a confirmation dialog.
- **OTP Reading** — retrieve a one-time password with copy-to-clipboard.
- **Real-Time Monitoring** — live WebSocket activity feed with a bounded 500-message buffer.
- **Unified Dashboard** — run every operation from one screen with a persisted email and per-operation result panels.

## Tech Stack

- React 18 + TypeScript
- Vite 6 (build/dev server)
- React Router v6 (client-side routing)
- Axios (HTTP client)
- Jest + React Testing Library + fast-check (unit, integration, and property-based tests)
- jest-axe (accessibility checks)

## Project Structure

```
src/
  components/      Reusable UI (EmailInput, ActionButton, ConfirmDialog, ToastNotification, tables, panels)
  context/         AuthContext, NotificationContext
  infrastructure/  httpClient (Axios), sessionStore
  layout/          Header, Sidebar, MainLayout (route + viewport guards)
  pages/           Login, AccountCheck, Account12h, Variable, Reinvite, OTP, Monitor, Dashboard
  services/        authService, accountService, otpService, webSocketService
  types/           Shared TypeScript contracts
  utils/           emailValidation, messageQueue, routeGuard, appConfig
```

## Getting Started

Requires Node.js 20+.

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm run build      # type-check (tsc -b) and produce a production build in dist/
npm run preview    # preview the production build locally
npm test           # run the full test suite
```

## Configuration

Backend endpoints live in `src/utils/appConfig.ts`:

| Setting            | Value                              | Purpose                                            |
| ------------------ | ---------------------------------- | -------------------------------------------------- |
| `apiBaseUrl`       | `https://api-2026-02.ades.support` | ADES Support API base URL                          |
| `variableBaseUrl`  | `https://var.ctv.ac`               | External variable service (called without auth)    |
| `requestTimeoutMs` | `30000`                            | Default request timeout                            |

> These are currently hard-coded. If you need per-environment endpoints, migrate them to Vite environment variables (`import.meta.env.VITE_*`) before deploying to multiple environments.

## Testing

```bash
npm test                         # everything
npx jest src/pages/DashboardPage # a single folder/file
```

The suite includes 13 property-based tests (fast-check) covering the correctness properties in the spec, plus unit, integration, and accessibility (jest-axe) tests. The accessibility checks catch many issues but are not a substitute for full WCAG validation, which requires manual testing with assistive technologies and expert review.

## Security Notes

- The auth token is stored in `sessionStorage` and attached to ADES API requests; the external variable service is intentionally called without the Authorization header.
- A 401 response clears the token and redirects to login.
- This frontend assumes the ADES Support API enforces authentication and authorization server-side — it is a client, not a security boundary.

## Deployment

This is a static single-page application, so it can be hosted on any static host or CDN. See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare Pages instructions.
