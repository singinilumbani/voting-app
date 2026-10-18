# Backend API reference

This reference describes the existing legacy API. It is not the future multi-tenant beta API. No endpoints were changed as part of the tooling migration.

## TypeScript skeleton endpoint

### `GET /api/v1/health`

- **Auth:** None.
- **Request:** No body.
- **Response:** `200 { "status": "ok", "env": "development|test|staging|production", "time": "<UTC ISO 8601 timestamp>" }`.
- **Errors:** `500 { "error": { "key": "errors.internal", "requestId": string } }`.
- **Headers:** Responses include `X-Request-Id`. Other errors use `{ "error": { "key": string, "params"?: object, "requestId": string } }`.

All responses are JSON except candidate creation, which uses `multipart/form-data`. Error responses use the `error` key.

## Public endpoints

### `GET /`

- **Auth:** None.
- **Request:** No body.
- **Response:** `200 { "message": "Voting API is alive" }`.
- **Errors:** None defined by the route.

### `GET /api/positions`

- **Auth:** None.
- **Request:** No body.
- **Response:** `200` with an array of positions, each containing its candidates.
- **Errors:** `500 { "error": "Failed to fetch positions" }`.

### `POST /api/auth/login`

- **Auth:** None.
- **Request:** JSON `{ "email": string, "password": string }`.
- **Response:** `200 { "token": string }`.
- **Errors:** `400 { "error": "Email and password are required" }`; `401 { "error": "Invalid credentials" }`; `500 { "error": "Login failed" }`.

### `GET /api/vote/status`

- **Auth:** A `voter_token` HTTP-only cookie is issued when absent; no bearer login is required.
- **Request:** No body.
- **Response:** `200` with an array of `{ "position_id": string, "candidate_id": string }` rows associated with the cookie token.
- **Errors:** `500 { "error": "Failed to fetch vote status" }`.

### `POST /api/vote`

- **Auth:** The `voter_token` HTTP-only cookie, issued when absent.
- **Request:** JSON `{ "positionId": string, "candidateId": string }`.
- **Response:** `201 { "message": "Vote recorded", "vote": object }`.
- **Errors:** `400 { "error": "positionId and candidateId are required" }`; `400 { "error": "Invalid candidate for this position" }`; `409 { "error": "You have already voted for this position" }`; `500 { "error": "Failed to record vote" }`.

## Protected admin endpoints

All endpoints under `/api/admin` require `Authorization: Bearer <token>` from the login endpoint.

### `POST /api/admin/positions`

- **Request:** JSON `{ "title": string }`.
- **Response:** `201` with the created position row.
- **Errors:** `400 { "error": "Title is required" }`; `500 { "error": "Failed to create position" }`.

### `PUT /api/admin/positions/:id`

- **Request:** JSON `{ "title": string }`.
- **Response:** `200` with the updated position row.
- **Errors:** `404 { "error": "Position not found" }`; `500 { "error": "Failed to update position" }`.

### `DELETE /api/admin/positions/:id`

- **Request:** No body.
- **Response:** `200 { "message": "Position deleted" }`.
- **Errors:** `500 { "error": "Failed to delete position" }`.

### `POST /api/admin/candidates`

- **Request:** `multipart/form-data` fields `name`, optional `bio`, `positionId`, and required image file `photo`.
- **Response:** `201` with the created candidate row.
- **Errors:** `400 { "error": "name, positionId, and photo are required" }`; `500 { "error": "Failed to create candidate" }`.

### `DELETE /api/admin/candidates/:id`

- **Request:** No body.
- **Response:** `200 { "message": "Candidate deleted" }`.
- **Errors:** `500 { "error": "Failed to delete candidate" }`.

### `GET /api/admin/results`

- **Request:** No body.
- **Response:** `200` with an array of positions and their candidates, including `voteCount`.
- **Errors:** `500 { "error": "Failed to fetch results" }`.

## Authentication errors

Protected admin routes return `401 { "error": "No token provided" }` when the bearer token is absent and `401 { "error": "Invalid or expired token" }` when verification fails.

## Host account API

Host account endpoints use `/api/v1/host/auth`. Authentication uses the `host_session` HttpOnly, Secure, SameSite=Lax cookie; session credentials are never returned in JSON. Error responses retain the common shape `{ "error": { "key": string, "params"?: object, "requestId": string } }`. Request validation errors use `errors.validation.failed`.

The successful host DTO contains `id`, `username`, `email`, `accountType`, `plan`, `createdAt`, `purgeAt`, and `lastLoginAt`. It never contains the password hash or a raw session/reset token.

### `POST /api/v1/host/auth/signup`

- **Auth:** None.
- **Request:** JSON `{ "username": string, "password": string, "email": string, "accountType": "TEMPORARY" | "LONG_TERM", "termsAccepted": true }`. Username must be 3-80 alphanumeric characters; password must be 12-256 characters.
- **Response:** `201 { "accountType": "TEMPORARY" | "LONG_TERM" }` with a new `host_session` cookie when email verification is disabled. With `ENABLE_EMAIL_VERIFICATION=true`, returns `202 { "accountType": ... }`, sends a verification link, and does not issue a session until the address is verified.
- **Errors:** `400 errors.validation.failed`; `409 errors.host_auth.username_taken`; `409 errors.host_auth.email_taken`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/login`

- **Auth:** None.
- **Request:** JSON `{ "username": string, "password": string }`.
- **Response:** `200 { "host": HostDto }` and the `host_session` cookie.
- **Errors:** `400 errors.validation.failed`; `401 errors.host_auth.invalid_credentials` for either an unknown username, incorrect password, or unverified email; `429 errors.host_auth.rate_limited`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/logout`

- **Auth:** Optional `host_session` cookie; the cookie is cleared whether or not it is valid.
- **Request:** No body.
- **Response:** `204` and a cleared `host_session` cookie.
- **Errors:** `503 errors.auth.not_configured` if the auth database is unavailable.

### `GET /api/v1/host/auth/me`

- **Auth:** Required `host_session` cookie.
- **Request:** No body.
- **Response:** `200 { "host": HostDto }`.
- **Errors:** `401 errors.auth.unauthorized`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/forgot-password`

- **Auth:** None.
- **Request:** JSON `{ "email": string }`.
- **Response:** `202 { "messageKey": "status.host_auth.password_reset_if_exists" }` for both known and unknown addresses. A reset link is emailed only when an account matches.
- **Errors:** `400 errors.validation.failed`; `429 errors.host_auth.rate_limited`; `503 errors.auth.not_configured`.
- **Email link:** `APP_BASE_URL/reset-password?token=...`; a configured provider delivery failure is logged without changing the neutral response.

### `POST /api/v1/host/auth/reset-password`

- **Auth:** None.
- **Request:** JSON `{ "token": string, "password": string }`. The token is single-use, expires after one hour, and the new password must be 12-256 characters.
- **Response:** `200 { "messageKey": "status.host_auth.password_reset" }`.
- **Errors:** `400 errors.validation.failed`; `400 errors.host_auth.reset_token_invalid`; `503 errors.auth.not_configured`.

### `GET /api/v1/host/auth/verify-email` (verification-enabled deployments)

- **Auth:** None.
- **Request:** Query string `token=<single-use token>`.
- **Response:** `200 { "messageKey": "status.host_auth.email_verified" }`.
- **Errors:** `400 errors.validation.failed`; `400 errors.host_auth.verification_token_invalid`; `503 errors.auth.not_configured`.
- **Email link:** sent to `APP_BASE_URL/verify-email?token=...`; the front end can then call this verification endpoint.

### `PATCH /api/v1/host/auth/profile`

- **Auth:** Required `host_session` cookie.
- **Request:** JSON with at least one of `{ "username"?: string, "email"?: string }`.
- **Response:** `200 { "host": HostDto, "verificationRequired": boolean }`. Changing email clears its verification timestamp; when verification is enabled, a new verification link is sent.
- **Errors:** `400 errors.validation.failed`; `401 errors.auth.unauthorized`; `409 errors.host_auth.username_taken`; `409 errors.host_auth.email_taken`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/change-password`

- **Auth:** Required `host_session` cookie.
- **Request:** JSON `{ "currentPassword": string, "newPassword": string }`.
- **Response:** `200 { "messageKey": "status.host_auth.password_changed" }`. Other sessions are revoked; the current session remains active.
- **Errors:** `400 errors.validation.failed`; `401 errors.host_auth.current_password_invalid`; `401 errors.auth.unauthorized`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/change-tier`

- **Auth:** Required `host_session` cookie.
- **Request:** JSON `{ "accountType": "TEMPORARY" | "LONG_TERM", "confirm"?: "DELETE" }`. Downgrading from long-term requires `confirm: "DELETE"`.
- **Response:** `200 { "host": HostDto }`.
- **Errors:** `400 errors.validation.failed`; `400 errors.host_auth.tier_downgrade_confirmation_required`; `401 errors.auth.unauthorized`; `503 errors.auth.not_configured`.

### `POST /api/v1/host/auth/export-data`

- **Auth:** Required `host_session` cookie.
- **Request:** No body.
- **Response:** `200` JSON export containing the host profile, owned stations and their categories/candidates, registered voters, device records, cast votes, activity log, and payments as separate collections. Cast votes are not joined to voters.
- **Errors:** `401 errors.auth.unauthorized`; `503 errors.auth.not_configured`.

### `DELETE /api/v1/host/auth/account`

- **Auth:** Required `host_session` cookie.
- **Request:** JSON `{ "confirm": "DELETE" }`.
- **Response:** `204` and a cleared `host_session` cookie. This permanently deletes the host and all station-owned data in the same transaction.
- **Errors:** `400 errors.validation.failed`; `400 errors.host_auth.account_deletion_confirmation_required`; `401 errors.auth.unauthorized`; `503 errors.auth.not_configured`.
