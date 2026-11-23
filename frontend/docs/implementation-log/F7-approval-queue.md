# F7 — Host approval queue

Date: 2026-11-23

## Goal

Implement the Closed Vote approval queue with registration counts, integrity
metrics, searchable and filterable voter rows, status-aware actions, bulk
operations, and CSV export.

## Files created or changed

- Added `src/components/host/ApprovalQueue.tsx` with `ApprovalQueue`,
  `VoterRow`, and `BulkActionBar`.
- Added `src/components/host/ApprovalQueue.test.tsx` for row permissions,
  lifecycle locks, single and bulk actions, token handling, search, WhatsApp
  links, integrity alerts, and export behavior.
- Updated `src/components/host/StationDetail.tsx` to render the queue for Closed
  Vote stations and omit the Voters tab for Public Poll stations.
- Updated `src/lib/api/schemas.ts` and `src/lib/api/voters.ts` to validate voter
  status and WhatsApp URLs, strip unknown voter-list fields, validate counts,
  and check the CSV header.
- Added empty-queue, integrity, and CSV MSW responses in
  `src/mocks/handlers.ts`.
- Added translated queue copy and voter-action errors in
  `src/locales/en.json`.
- Added responsive queue styling in `src/styles/globals.css`.
- Updated `docs/screens.md` and this implementation-log index.
- Adjusted the shared Tabs JSX branch structure in
  `src/components/ui/primitives.tsx` to avoid a false-positive hard-coded-text
  warning from the i18n checker; behavior is unchanged.
- Updated `scripts/require-pnpm.mjs` and
  `src/components/require-pnpm.test.ts` so the pnpm guard remains reliable with
  both lowercase and uppercase Windows environment variable names.

## Decisions and deviations

- The requested `docs/api-reference.md` is absent. Used
  `docs/reference/api.md`, which documents the voter endpoints and response
  fields.
- The list schema strips unknown fields so a token field accidentally included
  in a voter-list response cannot be cached or rendered. Reissued tokens are
  held only in component state while their dialog is open and cleared when it
  closes.
- The API contract accepts an optional rejection reason for an individual
  rejection, but not for `voterIds` bulk rejection. The optional reason is
  therefore offered for individual rejection only; bulk rejection follows the
  documented request shape.
- CSV download uses the documented export endpoint and validates its header as
  `full_name,phone_number,status`.
- Public Poll stations do not show a Voters tab; direct access to the segment
  displays the existing Public Poll explanation without loading voter data.
- MSW returns an empty voter list for locally mocked stations. No backend files
  were changed.

## Changes needed outside frontend

- None. The required voter endpoints are already described in the frontend API
  reference.

## Commands run

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `pnpm exec vitest run src/components/host/ApprovalQueue.test.tsx`
- `pnpm exec vitest run src/components/host/StationDetail.test.tsx`
- `pnpm exec vitest run src/components/host/ApprovalQueue.test.tsx src/components/host/StationDetail.test.tsx`
- `pnpm exec prettier --write` for the modified frontend source and docs files
- `git status --short`
- `git diff --check`

## Test results

- TypeScript check: passed.
- ESLint: passed.
- Focused approval queue tests: passed (20 tests).
- Focused station detail tests: passed (20 tests).
- Pnpm guard tests: passed (2 tests).
- Full Vitest suite: passed (26 files, 145 tests).
- Design token check: passed.
- Translation check: passed.
- Production build: passed.
- `git diff --check`: passed.

## Manual steps

- Verify queue actions and CSV download against a live Closed Vote station with
  registrations.
- Confirm generated WhatsApp URLs and the production CSV response match the
  documented API contract.
- Check that a reissued token can be copied by the host and is no longer
  displayed after the dialog closes.

## Open questions

- Should the API support an optional reason for rejecting a selected group of
  voters? Its current bulk endpoint only accepts a reason with `allPending`.
