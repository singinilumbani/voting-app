# M10: Scheduler jobs

**Date:** 2026-10-18

## Goal

Implement idempotent scheduled jobs for station lifecycle transitions, retention purges, and host account lifecycle notifications. Support both Cloudflare Cron Triggers and local execution with `pnpm jobs:run`.

## Files created

- `src/modules/jobs/jobs.repository.ts`
- `src/modules/jobs/jobs.test.ts`
- `src/modules/jobs/jobs.ts`
- `src/modules/jobs/jobs.types.ts`
- `src/modules/jobs/run.ts`
- `src/modules/jobs/runner.ts`
- `src/db/migrations/0006_dry_catseye.sql`
- `src/db/migrations/0007_unusual_kree.sql`
- `src/db/migrations/meta/0006_snapshot.json`
- `src/db/migrations/meta/0007_snapshot.json`

## Files changed

- `.dev.vars.example`
- `package.json`
- `src/config/env.test.ts`
- `src/config/env.ts`
- `src/db/migrations/meta/_journal.json`
- `src/db/schema/polling-stations.ts`
- `src/db/schema/users.ts`
- `src/services/email.service.ts`
- `src/services/host-auth.service.test.ts`
- `src/services/host-auth.service.ts`
- `src/worker.ts`
- `wrangler.toml`
- `docs/implementation-log/M10-scheduler-jobs.md`

`docs/api.md` was not changed because this module adds no HTTP endpoints.

## Decisions and deviations

- Based on the user's clarification, raw voter/device data is purged for TEMPORARY and PAY_PER_USE stations; LONG_TERM FREE and PREMIUM station data is retained. PREMIUM stations are archived without raw-data deletion.
- A TEMPORARY account is deleted only after its associated stations have closed and their retention period has passed. Existing signup and tier-downgrade `purge_at` behavior is retained; the scheduler extends it to at least the station close time plus the configured retention period and blocks deletion while stations are active.
- `RETENTION_DAYS` defaults to 7 and is constrained to 7–14 days. Voter and device deletions are processed in batches of 100. Station and account work is also bounded.
- LONG_TERM hosts receive the inactivity warning at five months and are marked for deletion at six months; this job does not delete LONG_TERM accounts.
- Notification claims prevent duplicate warning emails across repeat runs, and failed email delivery releases the claim so a later run can retry.
- Scheduler logs contain job counts only, not names, phone numbers, tokens, or email addresses.
- Temporary account cleanup deletes candidate database records but does not remove their remote Cloudinary assets. Remote asset cleanup was not specified and remains an operational/product decision.
- No endpoints were added or changed, and no frontend files were touched.

## Commands run and results

- `pnpm --dir backend db:generate` — generated migrations 0006 and 0007.
- `pnpm --dir backend db:migrate` — applied migrations to the configured development and test databases.
- Read-only PostgreSQL index verification — all four scheduler indexes verified in both databases; migration 0006's notification column was also verified in both.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 181 tests passed, 11 skipped (19 files: 15 passed, 4 skipped).
- `pnpm --dir backend exec wrangler deploy --dry-run --outdir .wrangler/m10-dry-run` — passed; Wrangler accepted the Worker configuration.
- `git diff --check` — passed.
- A targeted PostgreSQL host-auth integration run passed (3 tests).
- A supplemental multi-file PostgreSQL integration run failed because integration files concurrently truncate the shared `vote_app_test` database, causing deadlocks and cross-test interference. It also exposed an existing stale assertion expecting four `registered_voters` indexes despite the existing M9 `registered_voters_station_voted_at_idx`. The standard test command above passed; these pre-existing integration-test coordination/assertion issues were not changed.

## Manual steps

1. Apply migrations 0006 and 0007 to any deployment database that has not received them; production was not modified.
2. Configure the Worker secrets, including `DATABASE_URL` and the email provider credentials/settings, then deploy the Worker to activate the cron schedules.
3. If required, set `RETENTION_DAYS` between 7 and 14; the default is 7. Review Cloudflare logs after deployment to confirm scheduled invocations and their count-only summaries.
4. Decide whether temporary account deletion should also remove associated remote Cloudinary assets, and implement/configure that cleanup if desired.

## Open questions

- Should retention cleanup remove Cloudinary candidate assets when it deletes the corresponding database records?
- The retention interpretation for LONG_TERM FREE stations was resolved by the user's clarification; no remaining spec conflict was identified.

## Scope check

`git status --short` showed changed paths only within the backend workspace. No changed path started with `../`; no frontend or parent-directory files were touched.
