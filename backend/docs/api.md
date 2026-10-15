# Backend API reference

This reference describes the existing legacy API. It is not the future multi-tenant beta API. No endpoints were changed as part of the tooling migration.

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
