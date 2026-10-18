# M9: Host analytics API

- **Date:** 2026-10-18
- **Goal:** Add host-owned station analytics snapshots, check-in audit data, and CSV result exports with low-cost SQL aggregation and a two-second per-station snapshot cache.

## Files created or changed

- `docs/api.md`
- `src/app.ts`
- `src/container.ts`
- `src/controllers/analytics.controller.ts`
- `src/core/express-locals.d.ts`
- `src/core/types.ts`
- `src/db/migrations/0005_absent_sersi.sql`
- `src/db/migrations/meta/0005_snapshot.json`
- `src/db/migrations/meta/_journal.json`
- `src/db/schema/cast-votes.ts`
- `src/db/schema/device-records.ts`
- `src/db/schema/registered-voters.ts`
- `src/middleware/analytics-service-lifecycle.ts`
- `src/repositories/analytics.repository.ts`
- `src/routes/host-stations.ts`
- `src/services/analytics.repository.ts`
- `src/services/analytics.service.test.ts`
- `src/services/analytics.service.ts`
- `src/shared/messages.ts`

## Decisions and deviations

- Snapshot queries aggregate ballot rows by station, category, and candidate in SQL. Closed Vote ballot totals and approved-voter counts come from `registered_voters`; Public Poll totals and possible duplicates come from `device_records`. No vote-to-voter or vote-to-device join was introduced.
- Snapshot cache entries are keyed per station, expire after two seconds, and are bounded to 1,000 entries. Station ownership is checked for each request, including cache hits.
- Audit data is limited to the newest 500 voted check-ins and selects only voter ID, name, and `voted_at` from `registered_voters`. It does not read `cast_votes`.
- Candidate percentages include abstentions in the category total; a tied leaderboard is reported only when multiple candidates share a nonzero top count.
- The optional streaming endpoint was not added.
- No deviations from the requested scope; no changes were needed outside the backend.

## Commands run

- `pnpm --dir backend exec vitest run src/services/analytics.service.test.ts`
- `pnpm --dir backend typecheck`
- `pnpm --dir backend lint`
- `pnpm --dir backend test`
- Applied pending migrations to the configured development and test databases using the `DATABASE_URL` and `TEST_DATABASE_URL` values from `.env.local` without printing their values.
- Verified all three analytics indexes exist in both databases via `pg_indexes`.
- `git -C backend diff --unified=0 -- docs/api.md | grep '^@@'`
- `date -u +%F`

## Test results

- Focused analytics tests: **8 passed**.
- Full test suite: **174 passed, 11 skipped; 14 test files passed, 4 skipped**.
- Typecheck: **passed**.
- Lint: **passed**.
- Development database: **3/3 analytics indexes present**.
- Test database: **3/3 analytics indexes present**.

## Manual steps

- No manual migration step is needed; the generated migration has been applied to both configured databases.
- No new environment variables or dependencies are required.

## Open questions

- The specification does not define audit pagination or retention. The endpoint currently returns at most 500 newest check-in records.
- The specification does not explicitly state whether category percentages should include abstentions. This implementation includes abstentions in the denominator.

## Changes needed outside backend

None.
