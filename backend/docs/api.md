# Backend API reference

This reference documents both the retained legacy API and the versioned multi-tenant beta API.

## TypeScript skeleton endpoint

### `GET /api/v1/health`

- **Auth:** None.
- **Request:** No body.
- **Response:** `200 { "status": "ok", "env": "development|test|staging|production", "time": "<UTC ISO 8601 timestamp>" }`.
- **Errors:** `500 { "error": { "key": "errors.internal", "requestId": string } }`.
- **Headers:** Responses include `X-Request-Id`. Other errors use `{ "error": { "key": string, "params"?: object, "requestId": string } }`.

Legacy candidate creation uses `multipart/form-data`; versioned host candidate endpoints accept JSON. Error responses use the `error` key.

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

## Host station and setup-wizard API

All `/api/v1/host/stations` endpoints require the authenticated `host_session` cookie and verify that the host owns the station. Request-validation errors use `400 errors.validation.failed`; missing or unowned stations use `404 errors.station.not_found`; state-locked changes use `409 errors.station.locked`. The station duration settings are persisted in `registration_duration_hours` and `voting_duration_minutes`.

### `POST /api/v1/host/stations`

- **Auth:** Required `host_session` cookie.
- **Request:** JSON `{ "name": string, "description"?: string | null, "mode": "PUBLIC_POLL" | "CLOSED_VOTE", "resultsVisibility"?: "IMMEDIATE" | "CONCEALED", "allowAbstain": boolean, "mobileOnly": boolean }`.
- **Response:** `201 { "station": StationDto }`. The new station is `DRAFT`; `publicId` is a cryptographically random share identifier. Public Poll stations start with the 2,500 ballot ceiling; Closed Vote stations start with the default voter cap.
- **Errors:** `400 errors.validation.failed`; `401 errors.auth.unauthorized`; `503 errors.station.not_configured`.

### `PATCH /api/v1/host/stations/:stationId`

- **Auth:** Required `host_session` cookie; station ownership required.
- **Request:** JSON with at least one of `name`, `description`, `resultsVisibility`, `allowAbstain`, or `mobileOnly`.
- **Response:** `200 { "station": StationDto }`.
- **Errors:** `400 errors.validation.failed`; `401 errors.auth.unauthorized`; `404 errors.station.not_found`; `409 errors.station.locked`.

### Category endpoints

| Method and path | Request | Response | Errors |
|---|---|---|---|
| `POST /api/v1/host/stations/:stationId/categories` | `{ "title": string }` | `201 { "category": CategoryDto }` | `400 errors.validation.failed`; `404 errors.station.not_found`; `409 errors.station.locked` |
| `PATCH /api/v1/host/stations/:stationId/categories/:categoryId` | `{ "title": string }` | `200 { "category": CategoryDto }` | `400 errors.validation.failed`; `404 errors.station.category_not_found`; `409 errors.station.locked` |
| `PUT /api/v1/host/stations/:stationId/categories/order` | `{ "categoryIds": string[] }` (must list every station category exactly once) | `200 { "categories": CategoryDto[] }` | `400 errors.validation.failed` (including invalid order); `404 errors.station.not_found`; `409 errors.station.locked` |
| `DELETE /api/v1/host/stations/:stationId/categories/:categoryId` | No body | `204` | `404 errors.station.category_not_found`; `409 errors.station.locked` |

All category endpoints require the host session and only mutate a station in `DRAFT`.

### Candidate endpoints

| Method and path | Request | Response | Errors |
|---|---|---|---|
| `POST /api/v1/host/stations/:stationId/categories/:categoryId/candidates` | `{ "name": string, "picture"?: URL | null }` | `201 { "candidate": CandidateDto }` | `400 errors.validation.failed`; `404 errors.station.category_not_found`; `409 errors.station.locked` |
| `PATCH /api/v1/host/stations/:stationId/candidates/:candidateId` | At least one of `{ "name"?: string, "picture"?: URL | null }` | `200 { "candidate": CandidateDto }` | `400 errors.validation.failed`; `404 errors.station.candidate_not_found`; `409 errors.station.locked` |
| `DELETE /api/v1/host/stations/:stationId/candidates/:candidateId` | No body | `204` | `404 errors.station.candidate_not_found`; `409 errors.station.locked` |

Candidate create/edit are allowed in `DRAFT` and `REG_OPEN`; delete is allowed only in `DRAFT`. Create/edit operations append `CANDIDATE_ADDED` or `CANDIDATE_EDITED` to the station activity log.

### `POST /api/v1/host/stations/:stationId/uploads/sign`

- **Auth:** Required `host_session` cookie; station ownership required.
- **Request:** No body.
- **Response:** `200 { "cloudName": string, "apiKey": string, "timestamp": number, "signature": string, "folder": string }`. The API secret is never returned; `folder` comes from `CLOUDINARY_UPLOAD_FOLDER` (default `voting-app`).
- **Errors:** `401 errors.auth.unauthorized`; `404 errors.station.not_found`; `409 errors.station.locked`; `503 errors.cloudinary.not_configured`.

### Configuration, launch, and lifecycle endpoints

| Method and path | Request | Response | Errors |
|---|---|---|---|
| `PUT /api/v1/host/stations/:stationId/registration-config` | Closed Vote only: `{ "voterCap": integer, "durationHours"?: integer }` (`durationHours` defaults to 12; range 1-24; voter cap 2-50,000) | `200 { "station": StationDto, "warningKey"?: "warnings.station.free_tier_voter_cap" }` | `400 errors.validation.failed`; `400 errors.station.registration_config_mode_invalid`; `404 errors.station.not_found`; `409 errors.station.locked` |
| `PUT /api/v1/host/stations/:stationId/voting-config` | `{ "startMode": "NOW" | "SCHEDULED", "startsAt"?: ISO-8601, "durationMinutes"?: integer }` (duration defaults to 720; range 15-1,440; scheduled starts must be after registration closes for Closed Vote and within seven days) | `200 { "station": StationDto }` | `400 errors.validation.failed`; `400 errors.station.scheduled_start_invalid`; `400 errors.station.voting_duration_invalid`; `404 errors.station.not_found`; `409 errors.station.locked` |
| `POST /api/v1/host/stations/:stationId/launch` | No body | `200 { "station": StationDto, "publicId": string, "shareLink": URL, "warningKey"?: "warnings.station.free_tier_voter_cap" }` | `400 errors.validation.failed` (incomplete ballot/config); `404 errors.station.not_found`; `409 errors.station.locked` |
| `POST /api/v1/host/stations/:stationId/extend-registration` | `{ "additionalHours": positive integer }` | `200 { "station": StationDto }` | `400 errors.validation.failed`; `409 errors.station.registration_not_open`; `404 errors.station.not_found` |
| `PATCH /api/v1/host/stations/:stationId/voter-cap` | `{ "voterCap": integer }` (must increase current cap and remain at or below 50,000) | `200 { "station": StationDto, "warningKey"?: "warnings.station.free_tier_voter_cap" }` | `400 errors.validation.failed`; `409 errors.station.voter_cap_locked`; `404 errors.station.not_found` |
| `POST /api/v1/host/stations/:stationId/start-voting` | First request `{}`; confirmation request `{ "confirm": true }` | First response `200 { "requiresConfirmation": true, "warningKey": "warnings.station.pending_voters", "pendingCount": integer }`; after confirmation `200 { "requiresConfirmation": false, "station": StationDto, "pendingCount": integer }` | `400 errors.validation.failed`; `409 errors.station.registration_not_closed`; `404 errors.station.not_found` |
| `POST /api/v1/host/stations/:stationId/cancel` | `{ "confirm"?: "CANCEL" }`; confirmation is required after voting opens | `200 { "station": StationDto }` | `400 errors.validation.failed`; `409 errors.station.cancel_confirmation_required`; `409 errors.station.invalid_transition`; `404 errors.station.not_found` |

The lifecycle scheduler (M10) is responsible for moving scheduled stations into their open states at `vote_starts_at` and closing windows at their configured end. A schedule is derived from station status, `isLaunched`, and the future start time; there is no separate persisted scheduled status.

### Host read endpoints

| Method and path | Auth and request | Response | Errors |
|---|---|---|---|
| `GET /api/v1/host/stations?filter=All&search=` | Host session; `filter` is `All`, `Active`, `Scheduled`, or `Past`; optional name search | `200 { "stations": StationDto[] }` (includes derived `scheduled`) | `401 errors.auth.unauthorized`; `503 errors.station.not_configured` |
| `GET /api/v1/host/stations/:stationId` | Host session; owned station | `200 { "station": StationDto }` with categories and candidates | `401 errors.auth.unauthorized`; `404 errors.station.not_found` |
| `GET /api/v1/host/stations/:stationId/activity-log` | Host session; owned station | `200 { "activity": ActivityDto[] }` | `401 errors.auth.unauthorized`; `404 errors.station.not_found` |

### `GET /api/v1/public/stations/:publicId`

- **Auth:** None.
- **Request:** No body; `publicId` is the unguessable public share identifier.
- **Response:** `200 { "station": { "publicId", "name", "mode", "status", "regStartsAt", "regEndsAt", "voteStartsAt", "voteEndsAt", "mobileOnly", "allowAbstain", "resultsVisibility", "categories"? } }`. `categories` and candidates are included only while the voting window is open.
- **Errors:** `404 errors.station.not_found`; `503 errors.station.not_configured`.
