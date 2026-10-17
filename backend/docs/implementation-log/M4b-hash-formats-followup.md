# M4b Hash Formats and Shared Utility Follow-up

- **Date:** 2026-10-17
- **Goal:** Apply clarifications to the M3 database and M4 shared utilities: row-based voter identity, database-enforced stored-hash formats, Web Crypto helpers, confirmed Malawi mobile rules, and consistent international phone display.

## Files created or changed

- `src/db/schema/registered-voters.ts`: retained `id` as the voter row primary key, `(polling_station_id, phone_number)` uniqueness and the station/token and station/approval indexes; documented the future row-lock/`has_voted` design; changed hash storage to text and added nullable-conditional HMAC hash format checks.
- `src/db/schema/device-records.ts`: documented the station-scoped client-device unique constraint and changed the fingerprint hash to text with a nullable-conditional format check.
- `src/db/schema/users.ts`: changed `password_hash` to text and added its specified format check.
- `src/db/schema/sessions.ts`, `src/db/schema/password-reset-tokens.ts`: changed stored hashes to text and added lowercase hex SHA-256 checks.
- `src/db/migrations/0001_low_tana_nile.sql` and migration metadata: generated a new additive migration. It widens only the hash columns to text and adds hash-format constraints. The earlier generated/applied migration was not edited.
- `src/db/scripts/reset.ts`: now drops the Drizzle migration-history schema as well as `public` before reapplying migrations; this fixes reset after migrations have previously been recorded.
- `src/db/scripts/seed.ts`: uses a syntactically valid PBKDF2-format placeholder hash with a code comment that M5 replaces it; it does not hash passwords.
- `src/db/database.integration.test.ts`: checks ballot secrecy, no `voter_id`, exact registered-voter indexes, phone uniqueness, hash constraints, shared regex sample behavior, and voter-cap constraints.
- `src/shared/crypto/crypto.ts`, `encoding.ts`, `hash-formats.ts`, `index.ts`: add Web Crypto hashes/HMAC, base64url encoding/decoding, secure random bytes, format regexes, and pure password-hash format/parse helpers.
- `src/shared/token/token.ts`: now implements `hashToken` through `hmacHex(secret, stationId + ":" + normalizedToken)`.
- `src/shared/constants.ts`, `src/shared/phone/normalize-phone.ts`: export `NATIONAL_NUMBER_LENGTH` and `MOBILE_NATIONAL_PREFIXES`, return `NOT_MOBILE` for the specified landline/non-mobile prefixes, and document the international-number display and WhatsApp URL rules.
- `src/shared/index.ts`: exports the crypto utilities.
- `src/shared/crypto/crypto.test.ts`, `src/shared/phone/normalize-phone.test.ts`, `src/shared/shared.test.ts`: cover the known-answer vectors, SQL-regex parity and updated Malawi/international phone rules.
- `docs/test-vectors/hash-formats.json`: Node-crypto-generated SHA-256/HMAC/hash/base64url/password-format known answers.
- `docs/test-vectors/phone-normalizer.json`: adds the specified TNM/Airtel mobile, landline, non-mobile, South African, too-short and too-long vectors.
- `vitest.config.ts`: resolves the existing `@/` source alias for Vitest, needed by the shared regex imports in Drizzle schemas and database tests.
- `docs/DEVELOPMENT.md`: explains stored hash formats and the temporary demo-host placeholder.
- `docs/build-prompts/copilot_backend_build_prompts.md`: replaces outdated “assumption” wording with the confirmed Malawi mobile rule and its exported configuration names.
- `docs/implementation-log/M3-database-layer.md`: replaces the outdated “unique `(polling_station_id, voter_id)`” question with the confirmed voter-row and station/phone design.
- `docs/implementation-log/M4-shared-utilities.md`: records the confirmed Malawi mobile rule and international display behavior instead of treating them as unresolved assumptions.
- `docs/implementation-log/M4b-hash-formats-followup.md`: this record.
- `docs/api.md` was not changed because no endpoint changed.

## `voter_id` search and correction record

- Searched `src/` and `docs/` for `voter_id` and descriptions of a unique `(polling_station_id, voter_id)` index.
- Corrected the outdated uncertainty in `docs/implementation-log/M3-database-layer.md`: voter identity is the `registered_voters` row; phone is unique within a station; M8 uses a row lock and `has_voted`; Public Poll uses its station-scoped device-record uniqueness.
- Added an explanatory schema comment and catalog test that explicitly check the clarified absence of a separate voter-id column/index.
- `docs/project-specification.md` was not edited, as instructed. Its sections 4.9 and 12.2 still contain the conflicting unique-index wording and need a maintainer-owned specification update.

## Decisions and deviations

- Inspection confirmed the existing schema/migration already had the correct primary key, station/phone unique index, station/token index and station/approval index, with no `voter_id` column or voter-id unique index. No index-removal migration was needed.
- The new migration is additive and does not rewrite the earlier generated migration.
- Hash SQL CHECK expressions are generated from the exported JavaScript regex sources. Unit tests exercise matching valid/invalid samples against JavaScript constants and PostgreSQL, and assert those regex sources occur in the generated migration.
- `registered_voters` and `device_records` nullable hash fields accept null, otherwise require 64 lowercase hex characters. Required session/reset token hash fields also use a null-aware check; their `NOT NULL` declarations remain in place.
- Password formatting/parsing validates the string representation only. No password derivation, verification, endpoints, or other business logic were added.
- Other explicitly international numbers with 8–15 digits display as `+` followed by canonical digits and use canonical digits without `+` in WhatsApp URLs. Malawi mobile numbers retain local display.
- A preflight found one old-format password hash in `vote_app_test`; the approved test-only reset removed it before installing the new CHECK constraint. `vote_app_dev` had no incompatible hashes and was not reset.
- The first test reset attempt exposed a stale Drizzle history schema: resetting only `public` made Drizzle try the new alteration migration against absent tables. `src/db/scripts/reset.ts` was corrected to drop the Drizzle history schema too; the second reset and migration succeeded on `vote_app_test`.
- An initial live test run found the new catalog/hash tests nested inside the phone-uniqueness test due to patch placement. The test file was reorganized into independent tests before final validation.
- No files outside the backend workspace were intentionally created or edited for this follow-up.

## Commands run

- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend db:generate` — generated `0001_low_tana_nile.sql`; the next run reported no schema changes.
- One-off `node -e` using Node's built-in `crypto` generated values for `docs/test-vectors/hash-formats.json`; the script was not saved.
- Preflight database queries loaded URLs from `.env.local` without printing them and reported counts only. `vote_app_dev` had no incompatible stored hashes; the existing test DB had one old-format password hash.
- Test-only `pnpm run db:reset` and `pnpm run db:migrate`, with `APP_ENV=test` and the validated `vote_app_test` URL — passed after the reset fix.
- Dev `pnpm run db:migrate` and `pnpm run db:seed`, with `APP_ENV=development` and the validated `vote_app_dev` URL — passed.
- Schema verification queries — confirmed both databases contain the changed tables, no `registered_voters.voter_id`, and exactly the expected voter indexes/checks.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed (80 passed, 6 PostgreSQL integration tests skipped because the URL is not exported in the shell).
- Loaded only the `vote_app_test` URL from backend `.env.local` in memory, without printing it, then ran `pnpm exec vitest run src/db/database.integration.test.ts` — 6 passed.
- `pnpm db:reset` (APP_ENV=test), `pnpm db:migrate` for test/dev, and `pnpm db:seed` for dev — passed as recorded above.
- `pnpm exec prettier --check ...` and `git diff --check` — passed.
- Final `git status --short` — all reported paths are backend-relative; no path starts with `../`.

## Test results

- TypeScript strict typecheck: passed.
- ESLint: passed.
- Vitest standard run: 80 passed; six PostgreSQL integration tests skipped because the database URL was not exported.
- Vitest PostgreSQL integration run using the validated `vote_app_test` URL from `.env.local`: 6 passed.
- Migration generation and migration application to `vote_app_dev` and `vote_app_test`: passed.
- `db:reset` for `vote_app_test`: passed after the reset-script fix.
- `db:seed` for `vote_app_dev`: passed; no password hash was computed.
- Hash format and index catalog queries: passed.

## Manual steps for me

- No application or database manual steps are needed for this change. Configure `TOKEN_HMAC_SECRET` for the later runtime flows that call the HMAC helpers.
- Update `docs/project-specification.md` sections 4.9 and 12.2 yourself if you want its voter-id index wording to match Clarification A.

## Open questions

- The retained specification still claims a unique `(polling_station_id, voter_id)` index, contrary to Clarification A. It was not edited at the user's request.
- The retained specification section 11.4 still calls the now-confirmed Malawi mobile rule an assumption. It was not edited at the user's request.
- For non-Malawi international input, only the requested generic E.164-style display is implemented; no national-format parsing or country calling-code validity database is included.

## Changes needed outside backend

- None were needed or made. The M4 log records a previously reported out-of-workspace patch artifact; this follow-up did not inspect, edit, or remove it.
