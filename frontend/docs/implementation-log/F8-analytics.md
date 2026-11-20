# F8 — Live analytics

Date: 2026-11-20

## Goal

Build the station analytics tab with live KPI cards, candidate leaderboards,
connection state, countdown, check-in audit drawer, and CSV export.

## Files created or changed

- Added `src/components/host/StationAnalytics.tsx` with `KpiCard`,
  `TurnoutGauge`, `CountdownTimer`, `ConnectionStatusBadge`,
  `CategoryLeaderboardCard`, `LeaderboardBar`, `AuditDrawer`, and `ExportMenu`.
- Added `src/components/host/StationAnalytics.test.tsx` for state transitions,
  turnout math, ties, Public Poll metrics, polling backoff/pause, audit privacy,
  countdown closure, connection variants, and CSV export.
- Updated `src/components/host/StationDetail.tsx` to render live analytics in
  the Analytics tab.
- Updated `src/lib/api/schemas.ts` and `src/lib/api/analytics.ts` to validate
  snapshot data, strip voter identity from audit results, and validate the
  analytics CSV header.
- Added snapshot, audit, and CSV MSW responses in `src/mocks/handlers.ts`.
- Added translated analytics copy in `src/locales/en.json` and responsive,
  reduced-motion-aware styles in `src/styles/globals.css`.
- Updated `docs/screens.md` and this implementation-log index.

## Decisions and deviations

- The requested `docs/api-reference.md` is absent. Used
  `docs/reference/api.md`; it documents snapshot, audit, and CSV endpoints but
  no streaming endpoint, so analytics uses polling only.
- Polling starts at 4 seconds while the station is in `VOTE_OPEN`, pauses while
  the document is hidden, stops after a final snapshot, and backs off up to
  30 seconds after failures.
- The audit endpoint returns station-wide events without a category ID. A
  category's activity control opens the station-wide check-in drawer; the UI
  labels it accordingly instead of implying a per-category association.
- The audit schema strips voter IDs, names, and any unknown fields; the drawer
  renders only the number of returned check-ins and timestamps.
- The API provides CSV but no PDF endpoint or PDF dependency is installed.
  PDF export is deferred; CSV is implemented using the documented endpoint.
- No backend files or dependencies were changed.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `pnpm exec prettier --write` for the modified frontend source and docs files
- `git status --short`
- `git diff --check`

## Test results

- TypeScript check: passed.
- ESLint: passed.
- Full Vitest suite: passed (22 files, 129 tests).
- Design token check: passed.
- Translation check: passed (515 keys).
- Production build: passed.
- Prettier and `git diff --check`: passed.
- The production build reported the existing Next.js middleware convention
  deprecation warning; no middleware changes were needed for analytics.

## Manual steps

- Verify live and final states, category leaderboard updates, and countdown
  against a deployed Closed Vote and Public Poll station.
- Confirm station-wide audit data and CSV column names match the deployed API.
- Review the 4-second polling load and 30-second failure backoff in the target
  hosting environment.

## Open questions

- Should the API associate audit events with categories? The current endpoint
  provides station-wide check-ins only.
- Should PDF export be added later with an approved client-side implementation
  or a backend report endpoint?
