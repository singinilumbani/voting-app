# F6 — Station detail and lifecycle

Date: 2026-11-20

## Goal

Build the host station detail page with routed tabs, status-aware actions,
candidate permissions, station settings, lifecycle dialogs, share QR, activity,
and visible-page status polling.

## What was deleted

Nothing.

## Files created or changed

- Added station detail pages for `/host/stations/[id]` and the routed tab
  segments under `/host/stations/[id]/[tab]`.
- Added `StationDetail.tsx` and its lifecycle, status, candidate permissions,
  settings, activity, share-link, and QR behavior.
- Added `StationDetail.test.tsx` for contextual actions, permissions, settings,
  dialogs, activity filtering, and public links.
- Extended the shared `Tabs` component with URL-backed links and reused it for
  the station's route-segment tabs, retaining keyboard focus navigation.
- Extracted the F5 candidate form into `CandidateEditorDialog.tsx` and reused it
  in the wizard and the detail page. Editing an existing candidate now sends
  `picture: null` when its image is removed.
- Extended station API schemas and methods for activity logs, registration
  extension, and voter-cap increases.
- Added matching MSW handlers, translations, and responsive styles.
- Updated `docs/screens.md` and this implementation-log index and entry.

## Decisions and deviations

- The requested `docs/api-reference.md` is absent. Used
  `docs/reference/api.md` as the available API contract.
- Tabs are URL segments (`overview`, `candidates`, `voters`, `analytics`,
  `settings`); `/host/stations/[id]` renders Overview directly.
- The zero-approved-voter requirements conflict: section 4.8 says registration
  cannot reopen, but also mentions offering a new registration window. The
  documented API only extends registration while it is open and has no reopen
  endpoint. Following the user's `follow_api` choice, the dialog explains that
  voting cannot start and offers cancellation; it does not offer unsupported
  extension or reopen actions after registration has closed.
- `ActivityDto` fields and its complete event vocabulary are not defined in the
  API reference. The frontend validates the response and displays only a
  fixed allowlist of host-action event types; vote events and unknown event
  types are omitted.
- The share link uses the current app origin and `/s/<publicId>`; the QR-code
  component is loaded dynamically.
- No backend files were changed.

## Changes needed outside frontend

- None for the API-supported behavior selected here. To offer a new registration
  window after registration closes, the API needs an endpoint and the spec/API
  contract needs to clarify how that action relates to the no-reopen rule.
- The API reference should define the `ActivityDto` shape and host-action event
  types so the frontend allowlist can be kept in sync.

## Commands run

- `pnpm exec vitest run src/components/host/StationDetail.test.tsx src/components/host/StationWizard.test.tsx src/lib/polling.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm test`
- `pnpm build`
- `pnpm exec prettier --write` for the modified frontend source files
- `git status --short`
- `git diff --check`

## Test results

- TypeScript: passed.
- ESLint: passed.
- Focused F6/F5/polling tests: passed (24 tests across 3 files).
- Full Vitest suite: passed.
- Token check: passed.
- Translation check: passed.
- Production build: passed.
- `git diff --check`: passed.

## Manual steps

- Test the detail tabs and lifecycle mutations against the live API.
- Confirm deployed activity-log field names/event values match the documented
  contract; only allowlisted host actions are currently rendered.
- Verify the public app origin used for share links is the host-visible address
  in the production deployment.

## Open questions

- Should the zero-approved-voter UI ever offer a new registration window? If so,
  the spec and API need to resolve the current contradiction and provide a
  supported endpoint.
- What are the exact `ActivityDto` fields and complete host-action event types?
- The referenced `docs/api-reference.md` does not exist; should
  `docs/reference/api.md` remain the canonical API reference?
