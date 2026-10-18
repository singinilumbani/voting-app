# M12 — Test hardening and load-test preparation

**Date:** 2026-10-18

## Goal

Strengthen database-backed HTTP journey and concurrency tests, assert ballot
secrecy invariants, generate coverage for authentication/registration/voting,
and provide a k6 plan and script for a 2,500-voter Closed Vote scenario. The
load test was not executed.

## Files created or changed

Created:

- `src/controllers/journeys.integration.test.ts` — supertest journeys against
  the migrated `vote_app_test` database, including concurrent approvals,
  cap-boundary registration, and 50 parallel submissions for one voter.
- `load-test/vote-flow.js` — k6 voter-flow scenario with staging safeguards,
  error/latency metrics, rate-limit counts, and Workers request-budget
  extrapolation.
- `docs/load-test-plan.md` — local/staging setup, ramp profile, metrics,
  interpretation, and explicit production prohibition.

Changed:

- `package.json`, `pnpm-lock.yaml` — added `test:coverage` and pinned
  `@vitest/coverage-v8` to the installed Vitest version, 4.1.11.
- `vitest.config.ts` — serializes test files that truncate the shared test
  database, loads local test environment configuration, applies integration
  hook/test timeouts, and configures focused V8 coverage.
- `src/db/test-helpers.ts` — prefers `TEST_DATABASE_URL` and retains the
  `vote_app_test` database-name guard before migrations or truncation.
- `src/db/schema.test.ts` — checks cast-vote columns and foreign-key reachability
  do not connect votes to voter/device records.
- `src/db/database.integration.test.ts` — includes the existing
  `registered_voters_station_voted_at_idx` index in the schema expectation.

`docs/api.md` is unchanged: this task adds no endpoints or API contract changes.

## Decisions and deviations

- Integration suites previously ran concurrently while each truncated the same
  test database. The initial run showed cross-suite deadlocks and records
  disappearing during tests. Vitest file parallelism is now disabled so
  database integration files cannot race their setup/cleanup. Tests within a
  journey still issue their intended concurrent HTTP requests.
- The 50-request test replaces only the app's Cloudflare limiter bindings with
  always-allowing test doubles. This prevents production rate policies from
  obscuring the database row-lock race under test; production limiter behavior
  remains covered by its separate tests.
- V8 coverage is scoped to the three critical services. The generated HTML and
  JSON reports live in the ignored `coverage/` output directory; this log
  records the summary and remaining branch gaps.
- Closed Vote has registration, approval, check-in, and ballot entry. Public
  Poll intentionally omits registration/check-in and submits with device data.
- The k6 scenario performs host bulk approval after each successful
  registration so that a single scripted journey can proceed to status,
  entry, and submission without manual interaction. This synthetic pattern is
  not a recommendation for normal host operations.
- k6 results were not run, as requested. No production endpoint was contacted.

## Coverage report

`pnpm --dir backend test:coverage` passed all 207 tests in 21 files.
Coverage percentages below are for the selected critical service files:

| Module | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `host-auth.service.ts` | 79.59% | 73.61% | 96.42% | 79.48% |
| `voter.service.ts` | 77.45% | 62.25% | 85.29% | 77.64% |
| `voting.service.ts` | 81.68% | 75.82% | 100% | 84.86% |
| **Selected files combined** | **79.68%** | **70.85%** | **93.4%** | **80.72%** |

### Remaining untested branches in critical modules

- **Host authentication:** login rate-limit and failed-account-update paths
  (lines 123, 149); malformed, expired, or replayed session/reset/verification
  token paths (162–270); profile collision and verification-email rollback
  branches (281–310); wrong current password and account/tier deletion failure
  paths (337–390); and session/email persistence failure paths (395–488).
- **Registration and approval:** missing station and invalid/rejected-token
  handling (102–184); unexercised name/phone/status search combinations
  (205–236); voter-missing, status-locked, already-voted, and invalid-token
  reissue branches (283–333); rejection/bulk-rejection and missing/non-pending
  bulk-action branches (364–428); plus absent-secret configuration (472).
- **Voting:** invalid phone/token, phone-bound lockout, already-voted and
  immediate-results branches (56–131); invalid ballot-session and
  unapproved-voter branches (157–186); duplicate Public Poll device, capacity,
  and existing-device-update branches (219–247); invalid results-access
  audiences and unavailable-results cases (263–290); malformed/wrong-type
  sessions, denied abstention, wrong-mode/window, and missing-secret branches
  (314–443).

The new journeys cover the principal successful flows, but these negative and
provider-failure branches still merit focused tests before treating the
critical services as fully branch-covered.

## Commands run and results

- `pnpm --dir backend add -D @vitest/coverage-v8@^4.1.11` — installed the
  requested coverage provider; its first run showed a patch-version mismatch.
- `pnpm --dir backend install` — synchronized the exact 4.1.11 provider version
  with Vitest and the lockfile.
- `pnpm --dir backend typecheck` — passed.
- `pnpm --dir backend lint` — passed.
- `pnpm --dir backend test` — passed: 207 passed, 21 test files.
- `pnpm --dir backend test:coverage` — passed: 207 passed; coverage as above.
- `node --input-type=module --check < backend/load-test/vote-flow.js` — passed;
  this checks syntax only and does not execute k6.
- `git diff --check` — passed.

The first full test run exposed shared-database truncation races, test-only
rate-limit interference in the 50-submit case, an obsolete expected-index
list, and a PostgreSQL setup hook exceeding Vitest's default timeout. These
were addressed by serializing test files, injecting test limiter bindings,
updating the expected schema index list, and extending hook/test timeouts.

## Manual steps

1. The test runner loads `backend/.env.local`, prefers `TEST_DATABASE_URL`, and
   refuses to migrate/truncate unless the selected database path is
   `/vote_app_test`. Keep that URL pointed only at the disposable test database.
2. To regenerate coverage and its HTML report, run `pnpm --dir backend
   test:coverage`.
3. For k6, start local `wrangler dev` or use the verified staging Worker and
   staging database. Prepare a launched Closed Vote station, then supply its
   host cookie and station/category/candidate/public IDs as documented in
   `docs/load-test-plan.md`.
4. Review staging-only rate limits before running: the app's per-IP route
   policies can limit a single load generator below Workers' 1,000 requests per
   minute platform limit. Never run the k6 script against production.

## Open questions and limits

- The prompt requests 2,500 voters while the app's per-IP application limits
  can throttle a single load-generator IP well below the Workers burst limit.
  Decide whether the intended result is to measure those production protections
  or to use a staging-only rate-limit setup/multiple controlled egress IPs to
  measure application capacity.
- k6 reports HTTP latency and request-rate projections, not Workers CPU time.
  Check the staging Worker dashboard separately for CPU and subrequest limits.
- The 2,500-voter recommendation remains provisional until the owner runs and
  evaluates a controlled non-production load test.
- No API specification sections required clarification; no endpoint contracts
  changed.
