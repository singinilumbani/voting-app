# M8 Voting API Implementation Log

- **Date:** 2026-10-18
- **Goal:** Implement secure Closed Vote ballot entry/submission, Public Poll ballot submission, and visibility-gated results without linking cast votes to voters or devices.

## Files created or changed

- `src/services/voting.service.ts`, `src/services/voting.repository.ts`, `src/services/voting.service.test.ts`, `src/services/voting.service.integration.test.ts`
- `src/repositories/voting.repository.ts`
- `src/controllers/voting.controller.ts`, `src/middleware/voting-service-lifecycle.ts`
- `src/app.ts`, `src/container.ts`, `src/core/types.ts`, `src/routes/host-stations.ts`
- `src/repositories/voter.repository.ts`, `src/services/voter.repository.ts`, `src/services/voter.service.ts`, `src/services/voter.service.test.ts`
- `src/config/env.ts`, `src/config/env.test.ts`, `src/shared/messages.ts`
- `src/worker-configuration.d.ts`, `wrangler.toml`, `.dev.vars.example`
- `docs/api.md`
- `docs/implementation-log/M8-voting-api.md`

## Decisions and deviations

- Reused the existing `cast_votes`, `registered_voters`, and `device_records` schemas. No schema change or migration was needed. The cast-vote model remains limited to random vote UUID, station, category, and nullable candidate, with no voter/device reference and no timestamp.
- Added a SQL-only `VotingRepository` and injected `VotingService`; the request-scoped lifecycle follows the existing Cloudflare Worker database-client lifecycle.
- Closed Vote submission locks the station row to ensure its voting window remains open during the transaction, then locks the voter row, inserts all category votes, and marks the voter as voted with minute-truncated UTC time in that same transaction. This station lock also serializes Closed Vote submissions for the station; it favors lifecycle correctness over per-voter-only concurrency.
- Public Poll submission locks the station while checking the ballot ceiling and device record, then inserts/updates the device record and inserts cast votes within one transaction. Votes and devices are never joined.
- Signed ballot sessions are HMAC-protected and scoped to station/voter, with expiry at the earlier of the voting end or two hours. Results access tokens are signed and checked against the relevant voted voter/device record for immediate visibility; concealed results unlock only at `VOTE_CLOSED` or `ARCHIVED`.
- Five failed phone-bound token attempts start a 15-minute lock; the tenth also sets a host-visible flag. Successful entry clears accumulated failed attempts and the lock timestamp. Attempts without a phone use a hashed-IP in-memory limiter (20 attempts per minute); its response uses the same invalid-token key.
- Extended host integrity output with Public Poll ballot count and a possible-duplicates count based on repeated station-scoped device fingerprints. Fingerprint matches remain informational and do not reject submissions.
- Added `SESSION_SECRET` and the configurable `PUBLIC_POLL_BALLOT_CEILING` (default 2,500) to runtime configuration. Wrangler's local/default vars include the public-poll ceiling; the session secret remains a deployment secret.
- No vote choices or credentials are logged. The API returns signed ballot-session/results-access credentials only in the specified responses; error responses and logs do not echo the supplied voter token.
- **Changes needed outside backend:** None. No frontend files or files outside the backend workspace were changed.

## Commands run

- `pnpm --dir backend exec prettier --write ...` — formatted changed TypeScript files.
- `pnpm --dir backend types:worker` — regenerated Worker environment types after adding the public-poll ceiling setting.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 166 tests passed, 11 database-dependent tests skipped when the standard run had no `DATABASE_URL`.
- `pnpm --dir backend exec vitest run src/services/voting.service.test.ts src/services/voter.service.test.ts` — passed: 29 tests.
- Loaded the test database binding from the backend's private `.env.local` in a child process and ran `vitest run src/services/voting.service.integration.test.ts` against `vote_app_test` — passed: 1 PostgreSQL concurrency test; exactly one of 20 parallel submissions committed.
- `pnpm --dir backend exec prettier --write docs/api.md` — initially used, but its Markdown formatter reflowed unrelated existing tables. Those unrelated table changes were restored manually; the API documentation now contains only the endpoint/integrity additions.
- `git -C backend diff --check` — passed.
- `git -C backend status --short` — all reported paths are under `backend/`; no path starts with `../`.

## Test results

- Strict TypeScript, lint, and the complete default backend suite passed.
- Voting unit tests cover Closed Vote submission, the 20-way double-submit behavior, signed-session expiry, full-ballot and abstention validation, wrong-token phone lockout/flag thresholds, approved-state checks, normalized phone matching, Public Poll duplicate devices and capacity (including concurrent capacity submissions), immediate/concealed results, and no token echo in error responses or logs.
- The database-backed concurrency test passed against `vote_app_test`.
- The existing cast-vote schema test verifies the table contains only the four ballot columns and no timestamp.
- No migration was generated or applied because this module adds no database columns or tables.

## Manual steps

- Configure a private `SESSION_SECRET` of at least 32 characters in local and Cloudflare Worker secrets. Do not commit the real value.
- Keep `TOKEN_HMAC_SECRET` configured as required by the voter-registration module.
- Set `PUBLIC_POLL_BALLOT_CEILING` only if the default of 2,500 should differ.
- M10 must continue to transition stations at their configured voting start/end times. The in-memory IP limiter is temporary and should be replaced by the distributed Workers limiter in M11.

## Open questions and ambiguities

- The prompt asks for a test that no response or log line contains a token while also requiring the successful entry response to return a signed ballot session and immediate-results responses to return a signed access token. The implementation treats the privacy requirement as prohibiting raw voter-token echo/logging; the explicitly required signed credentials are returned only in their successful responses.
- The spec does not define a numeric threshold for the “loose” per-IP vote-entry limit. The beta implementation uses 20 failed attempts per minute per HMAC-hashed IP.
- Results access-token lifetime is not specified. Immediate-results tokens remain valid while their corresponding voted voter/device record exists.
