# M6 Host Station and Setup-Wizard API

- **Date:** 2026-10-18
- **Goal:** Implement host-owned station setup and lifecycle APIs, public station reads, Cloudinary signed uploads, station lifecycle rules, and related tests.

## Files created or changed

- `src/services/station-lifecycle.ts`, `src/services/station-lifecycle.test.ts`: pure mode-aware transition and derived-schedule logic, including cancellation confirmation.
- `src/services/station.service.ts`, `src/services/station.service.test.ts`, `src/services/station.repository.ts`: station business rules, ownership checks, configuration/window validation, lifecycle operations, Public Poll reads, and an injected repository port.
- `src/repositories/station.repository.ts`: SQL-only station, category, candidate, activity, and pending-voter operations.
- `src/controllers/station.controller.ts`, `src/routes/host-stations.ts`, `src/middleware/station-service-lifecycle.ts`: validated HTTP handling, authenticated host routes, public read route, and request-scoped service wiring.
- `src/app.ts`, `src/container.ts`, `src/core/types.ts`: application composition and route registration.
- `src/config/env.ts`, `src/config/env.test.ts`: Cloudinary credential, folder, and default configuration.
- `src/db/schema/polling-stations.ts`, `src/db/migrations/0003_reflective_wallop.sql`, `src/db/migrations/meta/0003_snapshot.json`, `src/db/migrations/meta/_journal.json`: persisted registration and voting durations for configuration performed before launch.
- `docs/api.md`: documented station endpoints, authorization, request/response shapes, and error keys.
- `docs/implementation-log/M6-station-api.md`: implementation record.

## Decisions and deviations

- Added `registration_duration_hours` and `voting_duration_minutes` to `polling_stations`. Setup values must persist while a station is still in `DRAFT`; existing window timestamps alone cannot store these choices before launch. The migration is additive and was applied to both `vote_app_dev` and `vote_app_test`.
- A Public Poll defaults to the shared 2,500 ballot ceiling. Closed Vote uses the shared default voter cap of 500. Closed Vote caps above the recommended free-tier limit remain valid and return `warnings.station.free_tier_voter_cap`.
- The start-voting warning is a two-step operation: the first request (no `confirm`) returns the pending count and warning key; the second request with `{ "confirm": true }` proceeds. This gives the host a chance to confirm without introducing another endpoint.
- Signed Cloudinary uploads use Web Crypto SHA-1 over Cloudinary's canonical `folder` and `timestamp` parameters plus the configured API secret. The API secret is never returned.
- Candidate create/edit operations and their activity entries commit in one transaction. Category reorder and category deletion are also transactional to avoid partial updates.
- The share link is constructed as `APP_BASE_URL/station/:publicId`; the specification requires share-link data but does not prescribe the front-end route.
- Scheduling remains derived from the station status, `isLaunched`, and `vote_starts_at`. The M10 scheduler is responsible for opening and closing scheduled voting windows; this module does not add scheduler behavior.
- Candidate create/edit activity rows use the existing `CANDIDATE_ADDED` and `CANDIDATE_EDITED` event types. The current activity-log schema does not store candidate IDs or change details.
- `docs/project-specification.md` and all files outside `backend/` were left unchanged. **Changes needed outside backend:** None.

## Commands run

- `pnpm --dir backend db:generate` — passed; the migration was generated, and the final run reported no schema drift.
- `pnpm --dir backend exec tsx -e ...` — applied migrations to `vote_app_dev` and `vote_app_test` using `.env.local` without printing database URLs or credentials.
- `pnpm --dir backend exec tsx -e ...` — queried `information_schema` on both databases; each returned `registration_duration_hours` and `voting_duration_minutes`.
- `pnpm --dir backend exec vitest run src/services/station-lifecycle.test.ts src/services/station.service.test.ts` — passed, 48 tests.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 137 passed, 9 skipped (database-dependent tests skipped by the standard suite without an exported `DATABASE_URL`).
- `pnpm --dir backend exec prettier --write ...` — formatted only changed TypeScript files.
- `pnpm --dir backend exec prettier --check ...` — passed for changed TypeScript files.
- `git status --short` — final path check recorded after all changes; no path started with `../`.

## Test results

- Strict TypeScript typecheck: passed.
- ESLint: passed.
- Full Vitest suite: 137 passed, 9 skipped.
- Station lifecycle and service tests: 48 passed, covering allowed/forbidden transitions, cancellation confirmation, candidate mutability by status, ownership rejection, voter-cap limits, and registration/voting/scheduled-start boundaries.
- Migration generation and live schema checks: passed for both development and test databases.
- Formatting check: passed.

## Manual steps for me

- Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable signed candidate image uploads. `CLOUDINARY_UPLOAD_FOLDER` is optional and defaults to `voting-app`.
- Ensure the front end consumes the documented two-step start-voting response and uses the share link route `/station/:publicId`.
- Implement the M10 scheduler to close registration and open/close voting at the persisted UTC timestamps.

## Open questions and ambiguities

- The specification does not name the share-link front-end path; this implementation uses `/station/:publicId` relative to `APP_BASE_URL`.
- The specification says start-voting warns before confirmation but does not define the confirmation request shape; this implementation uses `{ "confirm": true }`.
- No close-registration endpoint is listed. The service assumes the planned scheduler moves Closed Vote stations from `REG_OPEN` to `REG_CLOSED` before start-voting is called.
- No additional contradictory requirements were found.
