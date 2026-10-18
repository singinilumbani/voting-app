# M7 Voter Registration and Host Approval Queue

- **Date:** 2026-10-18
- **Goal:** Implement Closed Vote public voter registration/status and the host-side approval queue, including token storage, cap-safe concurrency, host actions, integrity reporting, CSV export, and tests.

## Files created or changed

- `src/services/voter.service.ts`, `src/services/voter.service.test.ts`, `src/services/voter.service.integration.test.ts`, `src/services/voter.repository.ts`: registration/approval business rules, pure service tests, and a PostgreSQL last-slot concurrency test.
- `src/repositories/voter.repository.ts`: SQL-only station/voter locking, registration counts, queue projection, aggregate counts, integrity values, and activity writes.
- `src/controllers/voter.controller.ts`, `src/middleware/voter-service-lifecycle.ts`, `src/routes/host-stations.ts`: zod-validated public and host HTTP endpoints, request-scoped service wiring, and nested voter routes.
- `src/app.ts`, `src/container.ts`, `src/core/types.ts`, `src/core/express-locals.d.ts`: dependency injection, rate-limiter wiring, and typed request locals.
- `src/config/env.ts`, `.dev.vars.example`, `docs/DEVELOPMENT.md`: `TOKEN_HMAC_SECRET` configuration, a non-secret placeholder for local Workers setup, and setup guidance.
- `src/db/schema/enums.ts`, `src/db/migrations/0004_clumsy_nighthawk.sql`, `src/db/migrations/meta/0004_snapshot.json`, `src/db/migrations/meta/_journal.json`: the `VOTER_BLOCKED` activity event.
- `src/shared/messages.ts`: registration and voter error-key constants.
- `docs/api.md`: public registration/status and host voter-queue endpoint contracts.
- `docs/implementation-log/M7-registration-approval.md`: this implementation record.

## Decisions and deviations

- Registration locks the `polling_stations` row inside a database transaction before checking duplicates and capacity. This serializes same-station registration attempts, preventing concurrent requests from both claiming the last slot. Pending and approved records count toward the cap.
- A rejected phone reuses the existing station-scoped voter row, updates its details and token hash, and increments `registration_attempts`. The initial registration is attempt one; three total attempts are allowed. Blocked numbers remain blocked.
- Every new or reissued token is returned only by that successful response; only its station-scoped HMAC is stored. Reissue atomically replaces the old hash and resets `failed_attempts` and `locked_until`.
- `TOKEN_HMAC_SECRET` is optional at application-config parsing for deployments that do not enable voter services, but registration, status, and reissue return an explicit configuration error when it is absent. When set, it must contain at least 32 characters.
- Public registration and status use separate in-memory rate limiters shared by the container: registration allows 30 attempts per minute per hashed-IP and per station-scoped phone key; status allows 40 checks per minute per hashed IP, so the specified 30-second polling cadence remains below the limit. This is temporary; M11 must replace it with a distributed Workers limiter.
- Queue projections do not select token hashes, IP hashes, or other credential data. Same-device flags count distinct other registrations matching either client device UUID or device fingerprint hash; they are informational and never block registration.
- Integrity `ballotsCast` counts `registered_voters.has_voted`; abstentions are counted independently from null-candidate `cast_votes` rows. The tables are queried separately and never joined. The spec's `cast_votes` design stores one row per category and has no ballot-group identifier, so aggregating submission rows alone cannot yield a ballot count.
- Blocking sets `registered_voters.blocked` and writes `VOTER_BLOCKED`; it does not automatically change approval status. The host can explicitly reject or revoke separately if the current registration must also lose eligibility.
- The M7 migration adds only the audit enum value; voter storage and the per-station phone uniqueness constraint already existed.
- **Changes needed outside backend:** None. The frontend was not touched, and `docs/project-specification.md` was not edited.

## Commands run

- `pnpm --dir backend db:generate` — passed; generated `0004_clumsy_nighthawk.sql`.
- `pnpm --dir backend exec tsx -e ...` — applied pending migration `0004` to `vote_app_dev` and `vote_app_test` by loading the matching database URLs from `.env.local` without printing them.
- `pnpm --dir backend exec vitest run src/services/voter.service.test.ts` — passed, 16 voter service unit tests.
- `pnpm --dir backend exec tsx -e ...` — set `DATABASE_URL` from the private `TEST_DATABASE_URL` process binding and ran `src/services/voter.service.integration.test.ts` against `vote_app_test`; passed.
- `pnpm --dir backend exec prettier --write ...` — formatted changed TypeScript source/tests.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — final result recorded below.
- `git diff --check` — passed.
- `git status --short` — final path check recorded after all changes; all listed paths were under `backend/`, with no path beginning `../`.

## Test results

- Strict TypeScript typecheck: passed.
- ESLint: passed.
- Full Vitest suite: 153 passed, 10 skipped (database-dependent suites are skipped in the standard run when `DATABASE_URL` is not exported).
- PostgreSQL integration test: passed against `vote_app_test`; of two concurrent registrations contending for the last available slot, exactly one succeeded.
- Unit coverage includes pending-plus-approved cap counting, cap slot freed by rejection, concurrent cap-boundary behavior, active duplicate rejection, three-attempt re-registration limit, block behavior, token reissue invalidation/reset, approval lock/open review window, CSV token exclusion, phone validation, international phone presentation, status rate limiting, device flags, and host-action audit events.
- Migration generation: passed with no schema drift after generation.
- Migration application: passed on `vote_app_dev` and `vote_app_test`; a read-only query confirmed `VOTER_BLOCKED` exists in each database's `activity_event` enum.

## Manual steps for me

- Set a private `TOKEN_HMAC_SECRET` (at least 32 characters) in local/Worker configuration. Do not commit the actual secret.
- Keep the M10 scheduler responsible for transitioning registration from `REG_OPEN` to `REG_CLOSED` at `reg_ends_at`; the registration cap does not close the window.
- Replace the in-memory rate limiters with the distributed Workers implementation when M11 is implemented.

## Open questions and ambiguities

- The schema stores one cast-vote row per category and does not identify a ballot group. The integrity endpoint therefore uses `has_voted` as the ballot count; abstentions are counted as null-candidate rows.
- The prompt does not state whether blocking a number should also immediately reject/revoke its current registration. This implementation blocks future attempts and leaves that eligibility decision to explicit reject/revoke actions.
- The prompt does not define registration/status rate-limit thresholds; the beta thresholds are documented above and are configurable at composition time.
