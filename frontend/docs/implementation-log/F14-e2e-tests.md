Date: 2026-11-24

## Goal

Add Playwright end-to-end coverage for host, Closed Vote, Public Poll, mobile
gate, lost-token, and route smoke journeys without starting or resetting the
backend.

## Files created or changed

- Added `playwright.config.ts` with mobile and desktop projects.
- Added `e2e/helpers.ts` for backend reachability, unique test data, sign-up,
  station creation, Cloudinary mocking, and station lookup.
- Added `e2e/journeys.spec.ts` for host, Closed Vote, Public Poll, mobile gate,
  and lost-token journeys.
- Added `e2e/route-smoke.spec.ts`.
- Added `pnpm test:e2e`.
- Updated `docs/DEVELOPMENT.md` and `docs/screens.md`.
- Added Playwright report/test-result directories to `.gitignore`.

## Decisions and deviations

- Playwright is the only added test dependency module.
- The frontend dev server may be started by Playwright when
  `PLAYWRIGHT_APP_URL` is local and unset. The backend is never started.
- Backend reachability is checked with `PLAYWRIGHT_API_BASE/api/v1/health`.
  Specs skip with an explicit message if the backend is unavailable.
- Test usernames, station names, and phone numbers are unique per run.
- No cleanup or backend reset is attempted.
- Candidate upload uses a small browser-supplied PNG and mocks the Cloudinary
  upload/sign response in-browser.
- Closed Vote end-to-end voting is gated by whether the real registration window
  closes. The API reference has no documented close/advance endpoint, so the
  test documents and skips that portion if the backend remains in registration.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm add -D @playwright/test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- E2E suite was not run because a user-owned backend reachability result could
- E2E suite was not run because the backend health check timed out/unreachable
  in this session.
- Playwright discovery via `pnpm exec playwright test --list`: passed (10 tests).

## Test results

- Unit, type, lint, and build checks pass in the closing run.
- Unit Vitest suite: passed (38 files, 188 tests).
- Playwright discovery: passed (10 tests in 2 files).
- Playwright specs are ready but require Chromium installation and a reachable
  real backend.

## Manual steps

1. Start the real frontend and backend in your own terminal windows.
2. Set `PLAYWRIGHT_APP_URL` and `PLAYWRIGHT_API_BASE`.
3. Run `pnpm exec playwright install chromium`.
4. Run `pnpm test:e2e`.
5. Review `test-results/` and `playwright-report/` for failures.

## Open questions

- The API reference does not document a registration-close endpoint; test
  lifecycle closure depends on a real short window or backend scheduler.
- Email verification must be disabled or handled externally for host sign-up.
- Cloudinary signing/upload must be configured or intercepted exactly as the
  test route expects.
