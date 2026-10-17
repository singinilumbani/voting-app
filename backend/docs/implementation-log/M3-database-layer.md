# M3 Database Layer

- **Date:** 2026-10-17
- **Goal:** Add the PostgreSQL/Drizzle persistence foundation required by specification sections 4.9, 9, and 12.2, without adding business logic or HTTP endpoints.

## Files created or changed

- `package.json`, `pnpm-lock.yaml`: add `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, and approved follow-up development dependency `@types/pg`; add `db:generate`, `db:migrate`, `db:seed`, and `db:reset`.
- `drizzle.config.ts`: configure PostgreSQL schema and migration generation under `src/db/migrations`.
- `wrangler.toml`: set the Worker database driver to `neon`.
- `src/config/env.ts`, `src/config/env.test.ts`: validate `DB_DRIVER` and optional `DATABASE_URL`.
- `src/container.ts`, `src/core/types.ts`, `src/app.ts`, `src/server.ts`, `src/worker.ts`, `src/middleware/database-lifecycle.ts`: inject database clients; share the Node pool for local server requests and create/close a Neon pool per Worker request; close the Node pool on server shutdown.
- `src/db/client.ts`, `src/db/factory.ts`, `src/db/neon-client.ts`, `src/db/node-postgres-client.ts`, `src/db/base.repository.ts`: define database/transaction types, runtime-specific clients, driver selection, transaction wrapper, and base repository helper.
- `src/db/schema/`: one Drizzle definition for each requested table: `users.ts`, `sessions.ts`, `password-reset-tokens.ts`, `polling-stations.ts`, `categories.ts`, `candidates.ts`, `registered-voters.ts`, `device-records.ts`, `cast-votes.ts`, `activity-log.ts`, and `payments.ts`; also `enums.ts` and `index.ts`.
- `src/db/migrations/0000_adorable_makkari.sql`, `src/db/migrations/meta/_journal.json`, `src/db/migrations/meta/0000_snapshot.json`: generated PostgreSQL schema migration and Drizzle metadata.
- `src/db/scripts/migrate.ts`, `src/db/scripts/reset.ts`, `src/db/scripts/seed.ts`, `src/db/test-helpers.ts`: migration, guarded reset, demo data seeding, and helpers that migrate/truncate only `vote_app_test`.
- `src/db/schema.test.ts`, `src/db/database.integration.test.ts`, `src/db/database-lifecycle.test.ts`: cast-vote schema introspection, PostgreSQL ballot-secrecy/uniqueness/cap constraints, and request-scoped client lifecycle tests.
- `src/repositories/`: SQL-only repositories for each table: `users.repository.ts`, `sessions.repository.ts`, `password-reset-tokens.repository.ts`, `polling-stations.repository.ts`, `categories.repository.ts`, `candidates.repository.ts`, `registered-voters.repository.ts`, `device-records.repository.ts`, `cast-votes.repository.ts`, `activity-log.repository.ts`, and `payments.repository.ts`.
- `docs/DEVELOPMENT.md`: document database configuration, scripts, integration-test safety, and the demo-host hash requirement.
- `docs/implementation-log/M3-database-layer.md`: this record.
- `docs/api.md` was not changed: this work introduces no endpoints.

## Decisions and deviations

- All persisted instants use PostgreSQL `timestamp with time zone`. `registered_voters.voted_at` has a database check constraint requiring zero seconds, so stored values have minute precision.
- `cast_votes` contains only `id`, `polling_station_id`, `category_id`, and nullable `candidate_id`; the generated migration, repositories, and schema test contain no voter/device link or vote timestamp. The activity log has a constrained event enum and no arbitrary payload field, preventing it from becoming a place to store vote data.
- The Neon Worker entry imports only the Neon client. It creates a fresh WebSocket Pool per request and closes it after the response; the Node server uses node-postgres and a shared pool, closed on SIGINT/SIGTERM. The CLI migration/reset scripts require `DB_DRIVER=pg`.
- `db:reset` accepts only `APP_ENV=development` with database `vote_app_dev` or `APP_ENV=test` with database `vote_app_test`, and refuses other drivers. Test helpers independently validate the test database name before migration or truncation.
- The demo seed requires `DEMO_HOST_PASSWORD_HASH`; it does not embed a usable password or generate password hashes. It creates a demo host and both voting modes with random public identifiers.
- `@types/pg` was added only after separate approval because the existing `pg` runtime dependency has no declarations and strict typechecking otherwise failed.
- At the initial implementation handoff, the actual PostgreSQL migrations and catalog/constraint integration tests had not been run because the shell did not load `.env.local`. The user subsequently confirmed the database URLs were in `backend/.env.local`; both migrations were applied successfully and the live database tests were run and passed.
- No implementation outside `backend/` was needed. The existing legacy JavaScript database module/schema were left unchanged; this module establishes the new TypeScript backend persistence layer without changing legacy routes.

## Commands run

- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend add drizzle-orm @neondatabase/serverless`
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend add -D drizzle-kit`
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend add -D @types/pg`
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend db:generate` — generated the initial migration; final run reported no schema changes.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend typecheck` — passed.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend lint` — passed.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend test` — passed; 8 tests passed and 3 PostgreSQL integration tests skipped without a configured test database.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend exec wrangler deploy --dry-run --config wrangler.toml` — passed; Worker bundle 2,391.32 KiB uncompressed / 518.31 KiB gzip.
- `APP_ENV=production DB_DRIVER=pg DATABASE_URL=postgres://localhost/vote_app_dev pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend db:reset` — refused as required.
- Loaded `DATABASE_URL` and `TEST_DATABASE_URL` from `.env.local` without printing either value, then ran `pnpm exec tsx src/db/scripts/migrate.ts` with `APP_ENV=development` / `APP_ENV=test` respectively — both completed successfully.
- Queried PostgreSQL catalogs for both configured databases — each contains all 11 requested tables; `cast_votes` has exactly `id`, `polling_station_id`, `category_id`, and `candidate_id`.
- Ran `pnpm test` with `DATABASE_URL` set to the configured `vote_app_test` URL — all 11 tests passed, including live catalog, uniqueness, and voter-cap assertions.
- Fixed the live constraint assertions to inspect the PostgreSQL error nested in Drizzle's `cause`.
- `git -C /home/Leo/Desktop/Legacy/voting-app/backend diff --check` — passed.
- Checked local PostgreSQL readiness/access earlier; the provided `.env.local` database URLs subsequently enabled successful migration and integration testing.

## Test results

- TypeScript strict typecheck: passed.
- ESLint: passed.
- Vitest without database credentials: passed, 8 passed / 3 skipped.
- Vitest against the configured `vote_app_test`: passed, 11 passed / 0 skipped. Live catalog introspection, phone uniqueness, and voter-cap checks all passed.
- Drizzle migration generation: passed; final schema and migration snapshot are synchronized.
- Migrations: successfully applied to `vote_app_dev` and `vote_app_test`; verified all 11 requested tables exist in each database.
- Wrangler Worker dry-run: passed.
- Reset protection: verified to reject a production environment before opening a connection.
- The seed and reset scripts were not run. The reset command was only invoked with `APP_ENV=production` to verify it refuses before connecting.

## Manual steps

- Migration has already been applied to both configured databases.
- To rerun the PostgreSQL integration tests, set `DATABASE_URL` to the `vote_app_test` database and run `pnpm test`. The helper migrates and truncates that test database.
- Set a precomputed password hash as `DEMO_HOST_PASSWORD_HASH` (and optionally `DEMO_HOST_EMAIL`) before running `pnpm db:seed`; no plaintext default password is supplied.
- Configure the Neon Worker `DATABASE_URL` as a secret. Wrangler already sets `DB_DRIVER=neon`.

## Open questions

- Specification section 4.9 mentions a unique `(polling_station_id, voter_id)` index on `RegisteredVoters`, but section 9 and this prompt define the voter table with `id` and require station/phone uniqueness without a `voter_id` column. The implementation applies the requested station/phone unique constraint and keeps all voter references out of `cast_votes`; clarify whether any additional voter-side index is intended.
- The specification does not define the hash representation or algorithm for password hashes and token hashes. The database stores supplied hashes only; generation/verification is outside this no-business-logic module.

## Changes needed outside backend

- None.
