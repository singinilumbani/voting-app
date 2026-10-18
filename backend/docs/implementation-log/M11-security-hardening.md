# M11: Security hardening

**Date:** 2026-10-18

## Goal

Harden the API rate limits, CORS/cookies, request handling, error responses, log redaction, token comparisons, and enumeration behavior. Document the protections and their known limits.

## Files created

- `docs/security-checklist.md`
- `docs/implementation-log/M11-security-hardening.md`
- `src/db/schema/rate-limit-counters.ts`
- `src/db/migrations/0008_loud_black_knight.sql`
- `src/db/migrations/meta/0008_snapshot.json`
- `src/middleware/request-timeout.ts`
- `src/repositories/rate-limit.repository.ts`
- `src/services/rate-limit.repository.ts`
- `src/services/rate-limiter.test.ts`

## Files changed

- `docs/api.md`
- `src/app.test.ts`
- `src/app.ts`
- `src/config/env.test.ts`
- `src/config/env.ts`
- `src/container.ts`
- `src/controllers/host-auth.integration.test.ts`
- `src/controllers/voting.controller.ts`
- `src/core/error-handler.ts`
- `src/core/logger.ts`
- `src/core/types.ts`
- `src/db/database.integration.test.ts`
- `src/db/migrations/meta/_journal.json`
- `src/db/schema/index.ts`
- `src/db/test-helpers.ts`
- `src/middleware/security-headers.ts`
- `src/server.ts`
- `src/services/host-auth.service.test.ts`
- `src/services/host-auth.service.ts`
- `src/services/rate-limiter.ts`
- `src/services/voter.service.integration.test.ts`
- `src/services/voter.service.test.ts`
- `src/services/voter.service.ts`
- `src/services/voting.service.integration.test.ts`
- `src/services/voting.service.test.ts`
- `src/services/voting.service.ts`
- `src/shared/messages.ts`
- `src/worker-configuration.d.ts`
- `src/worker.ts`
- `wrangler.toml`

No dependencies were added or changed.

## Decisions and deviations

- Workers use Cloudflare Rate Limiting bindings, configured at five requests per minute for the strict namespace and 30 per minute for the loose namespace. The bindings accept only 10- or 60-second periods and are per data-center location/eventually consistent. The database fallback provides fixed windows with expirations and atomic increments for Node/local deployments.
- Rate-limit keys are HMACed with `TOKEN_HMAC_SECRET` before being sent to Cloudflare or persisted. PostgreSQL fallback rows are keyed by HMAC, have expiry timestamps, and expired rows are deleted in bounded batches.
- Closed Vote wrong-token lockout remains based on `registered_voters.failed_attempts` and `locked_until`: five attempts lock for 15 minutes and ten set the host flag. IP and Cloudflare limits remain a soft control, not the lockout source of truth.
- Per-policy limits in the database fallback are five per 15 minutes for strict limits, 30 per minute for registration IP, 40 per minute for status IP, and 20 per minute for voting IP. Host login/forgot-password are limited by IP plus username/email; registration by IP and normalized station-scoped phone; status and vote entry by IP; and submission by IP plus a station-scoped voter key for Closed Vote.
- The generic `errors.host_auth.account_conflict` response is used for duplicate usernames and emails at signup/profile update. Per the user's selected behavior, it hides which identifier collided, but its `409` status still reveals that at least one identifier is already in use. Fully neutral signup would require changing immediate-session signup behavior.
- `COOKIE_DOMAIN` is validated as a hostname matching the app host or one of its parent domains. It remains empty by default for local use; configured session cookies retain `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- Added exact-origin credentialed CORS rejection, security headers, 1 MiB JSON body limits, malformed/oversized-body mappings, and a 30-second API timeout response. The local Node server also uses request/header timeouts.
- Error responses and structured logs do not include exception messages, SQL, stacks, or raw sensitive fields. HMAC/hash comparisons in authentication and token flows use constant-time comparison after lookup.
- No endpoints were added. Existing endpoint rate-limit errors and shared request errors are documented in `docs/api.md`.
- The PostgreSQL migration is generated but was not applied to development, test, or production databases in this task.

## Commands run and results

- `pnpm --dir backend db:generate` — generated migration 0008 for `rate_limit_counters`.
- `pnpm --dir backend run types:worker` — generated Cloudflare binding types for the strict and loose rate-limit bindings.
- Targeted Vitest security/rate-limit/auth/voter/voting tests — passed (55 tests in the latest targeted run).
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 191 passed, 12 skipped (20 files; 16 passed, 4 skipped).
- `pnpm --dir backend exec wrangler deploy --dry-run --outdir .wrangler/m11-final-dry-run` — passed.
- `git diff --check` — passed.
- `pnpm --dir backend audit` — exited with findings: 2 high and 1 moderate. No dependencies were changed:
  - **High:** `cloudinary` versions below 2.7.0, arbitrary argument injection with ampersand-containing parameters; present directly and through `multer-storage-cloudinary` (`GHSA-g4mf-96x5-5m2c`).
  - **High:** `braces` versions `<=3.0.3`, stack-exhaustion denial of service on deeply nested patterns; transitive through `nodemon > chokidar`; audit reported no patched version (`GHSA-vfj7-8cjw-p6xm`).
  - **Moderate:** `esbuild` versions `<=0.24.2`, development-server cross-origin request/response exposure; transitive through `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils`; patched versions are `>=0.25.0` (`GHSA-67mh-4wv8-2f99`).

## Manual steps

1. Apply migration 0008 to each PostgreSQL database used by local/non-Workers deployments before enabling database-backed rate limiting.
2. Deploy the Worker with `STRICT_RATE_LIMITER` and `LOOSE_RATE_LIMITER` bindings. Confirm the namespace IDs in `wrangler.toml` are unique in the Cloudflare account.
3. Configure strong private `TOKEN_HMAC_SECRET` and `SESSION_SECRET` values, set the correct `COOKIE_DOMAIN` for the app/API domain setup, and set exact allowed web origins in `CORS_ORIGINS`.
4. Review the three `pnpm audit` advisories and decide whether to upgrade/replace the existing vulnerable dependency paths.

## Open questions

- The selected generic signup conflict response still reveals a collision through HTTP 409; eliminating that signal would require a broader signup/session contract change.
- Cloudflare's per-location eventual consistency can admit bursts across regions or isolates; the voter-row token lockout remains authoritative for phone-bound token attempts.
- Request timeout handling returns a 408 but does not provide cancellation for arbitrary already-running application work; database statement timeouts may be warranted if slow queries become a risk.

## Changes needed outside backend

- None.

## Scope check

Only backend workspace files were changed. No path in `git status --short` starts with `../`; no frontend or parent-directory files were touched.
