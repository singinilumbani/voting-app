# M5 Host Accounts

- **Date:** 2026-10-18
- **Goal:** Implement host signup, login/session cookies, logout, profile and tier management, password change/reset, email verification, rate limiting, account export/deletion, and PBKDF2-SHA256 hashing using the M3 repository layer and shared Web Crypto utilities.

## Files created or changed

- `src/controllers/host-auth.controller.ts`, `src/routes/host-auth.ts`, `src/middleware/require-host.ts`, `src/middleware/host-session.ts`, `src/middleware/host-auth-service-lifecycle.ts`, `src/core/express-locals.d.ts`: HTTP validation, route wiring, secure cookie handling, authenticated host state, and per-request service wiring.
- `src/services/host-auth.service.ts`, `src/services/host-auth.repository.ts`, `src/repositories/host-auth.repository.ts`: host account flows, injected repository port, and SQL-only aggregate repository operations for sessions, exports and transactional deletion.
- `src/services/password-hasher.ts`, `src/services/email.service.ts`, `src/services/rate-limiter.ts`: Web Crypto PBKDF2-SHA256 hasher, Console/Brevo host-only email providers, and an in-memory rate limiter.
- `src/db/schema/email-verification-tokens.ts`, `src/db/schema/index.ts`, `src/db/migrations/0002_cultured_madame_masque.sql`, `src/db/migrations/meta/0002_snapshot.json`, `src/db/migrations/meta/_journal.json`: one-hour, single-use host email verification-token storage and migration.
- `src/config/env.ts`, `src/config/env.test.ts`: validation and defaults for hash iterations, email provider/verification, cookie domain and application link base URL.
- `src/app.ts`, `src/container.ts`, `src/core/types.ts`, `src/middleware/database-lifecycle.ts`: composed request-scoped service wiring while retaining existing database client lifecycle behavior.
- `src/db/scripts/seed.ts`, `src/db/test-helpers.ts`: seed a real PBKDF2 hash from required `DEMO_HOST_PASSWORD`, and truncate verification tokens during test setup.
- `src/services/host-auth.service.test.ts`, `src/controllers/host-auth.integration.test.ts`: unit tests for signup, duplicate accounts, neutral login errors, reset/verification and tier rules; database-backed HTTP tests for signup, profile/password, tier change, export, deletion, login and verification.
- `src/shared/messages.ts`: host-auth message-key constants.
- `src/shared/crypto/crypto.ts`, `src/shared/crypto/crypto.test.ts`: Web Crypto `BufferSource` compatibility fix and migration-regex coverage updated to inspect all migrations.
- `scripts/benchmark-password.ts`, `package.json`: `pnpm password:benchmark` runner.
- `docs/api.md`, `docs/DEVELOPMENT.md`, `docs/runtime-spike.md`: endpoint contracts, configuration/seed instructions, and password benchmark results.
- `docs/implementation-log/M5-host-auth.md`: this log.

## Decisions and deviations

- Session, reset and verification secrets are 32 random bytes encoded as base64url for clients; the database stores lowercase SHA-256 hex of the canonical base64url string. Session cookies are named `host_session`, HttpOnly, Secure, SameSite=Lax, Path=/, and live for 30 days.
- Passwords are PBKDF2-SHA256 with 16-byte random salts and a 256-bit derived key. `PASSWORD_HASH_ITERATIONS` defaults to 5,000. The available Node.js benchmark reported a 3.92-4.61 ms median at that setting; 10,000 iterations varied from 6.76-12.97 ms. The default favors the 10 ms Workers CPU budget, but is a low work factor and still needs measurement in the deployed Workers runtime before production use.
- Password input requires 12-256 characters. The source spec calls for strong-password thresholds but does not state exact thresholds.
- Login errors use the same key for unknown usernames, bad passwords and unverified accounts. Forgot-password returns the same 202 message key whether or not an account exists, including when Brevo delivery fails; delivery failures are logged without PII or tokens.
- Added `GET /api/v1/host/auth/verify-email` because email verification needs a backend operation to consume the required single-use token; the listed endpoint set did not specify this route. Email links target `APP_BASE_URL/verify-email` and `APP_BASE_URL/reset-password`, which are intended as front-end pages.
- Email verification tokens also expire after one hour. Session lifetime is set to 30 days. Both durations were not specified for host sessions or email-verification tokens.
- Temporary accounts receive `purge_at = signup time + 7 days`; downgrading to TEMPORARY sets it to the downgrade time + 7 days, and upgrading clears it. The retention spec instead anchors temporary purging to election completion, which this module cannot observe. The later election lifecycle must update `purge_at`.
- Account deletion transactionally removes the host's sessions, reset/verification tokens, payments, stations and station-owned records, including cast votes. Data export returns related records in separate collections and never joins cast votes to registered voters.
- `DEMO_HOST_PASSWORD` is required by `db:seed`; no static demo credential is embedded. The demo host is marked email-verified so the local seeded account remains usable when verification is enabled.
- Rate limiting is in-memory and allows five attempts per IP and per normalized username/email in a 15-minute window. This is an initial M11-replacement implementation, not a distributed production limiter.
- The Console email provider logs the template key and link-redacted content only; it does not log recipient addresses, tokens or credentials. Use Brevo or a test email adapter when a clickable verification/reset link is needed.
- `docs/project-specification.md` was not changed.

## Commands run

- `pnpm --dir backend db:generate` — passed; no schema drift remained.
- `pnpm` migration commands for both `vote_app_dev` and `vote_app_test`, loading the matching URLs from `.env.local` without printing them — passed; migration `0002_cultured_madame_masque.sql` was applied to each.
- `pnpm --dir backend password:benchmark` — default 5,000 iterations: 3.92 ms median in the final run (another run measured 4.61 ms); 10,000-iteration run: 6.76-12.97 ms; 100,000-iteration run: 65.38 ms.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 88 tests passed, 9 PostgreSQL integration tests skipped because no database URL was exported in the standard command environment.
- Database-backed host auth tests, using only the `vote_app_test` URL read from `.env.local` — passed: 3 tests.
- Database constraint tests, using `vote_app_test` — passed: 6 tests.
- `pnpm --dir backend db:seed` against `vote_app_test` with a generated ephemeral password supplied only through the child process environment — passed. No seed credential was printed or persisted in repository files.
- `pnpm exec prettier --check ...` for changed source/tests — passed.
- `git diff --check` — passed.
- Final `git status --short` — checked; no reported path starts with `../`.

## Test results

- TypeScript strict typecheck and ESLint: passed.
- Standard Vitest: 88 passed, 9 skipped (database-dependent suites skipped without `DATABASE_URL`).
- Live host-auth HTTP/database flow: 3 passed.
- Live M3 database constraints: 6 passed.
- `db:generate`: no schema drift.
- Additive migration: applied to development and test databases.
- Test-only seed smoke test: passed. The development database was not seeded because `.env.local` has no `DEMO_HOST_PASSWORD`.
- Node PBKDF2 benchmark: 5,000 iterations measured 3.92-4.61 ms median. Workers CPU behavior remains unmeasured.

## Manual steps for me

- Set a private `DEMO_HOST_PASSWORD` of at least 12 characters before running `pnpm db:seed`; the development seed was intentionally not run without this credential.
- Configure `APP_BASE_URL`, `PASSWORD_HASH_ITERATIONS`, `COOKIE_DOMAIN`, and (if required) `ENABLE_EMAIL_VERIFICATION`. For Brevo, configure `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and `EMAIL_FROM`.
- Measure PBKDF2 CPU usage in the deployed Workers runtime and tune the work factor. The 5,000 default improves CPU headroom but is weak for offline password-hash resistance.
- When enabling email flows, provide front-end `/verify-email` and `/reset-password` pages that consume the emailed token and call the documented API.
- The `vote_app_dev` and `vote_app_test` schema migrations are already applied; no manual migration step remains.

## Open questions

- Should `purge_at` start at signup/downgrade or only after an election concludes? Current implementation uses signup/downgrade + seven days as an initial deadline; the specification describes election completion.
- What minimum PBKDF2 iteration count is acceptable after measuring Workers CPU on the actual deployment plan?
- Should session lifetime remain 30 days, and should email-verification tokens have an explicit expiry requirement?
- Is `"DELETE"` the desired typed confirmation string for account deletion, and should deletion erase cast votes or preserve anonymized aggregates?
- The spec's strong-password thresholds are not numerically defined; this implementation uses a 12-character minimum.
- Long-term inactivity warnings and account purging, and election-completion retention scheduling, remain lifecycle work outside this auth module.

## Changes needed outside backend

- None were edited. The front-end application will need the two email-link pages described above to complete browser-based verification and password reset; frontend changes were out of scope and were not made.
