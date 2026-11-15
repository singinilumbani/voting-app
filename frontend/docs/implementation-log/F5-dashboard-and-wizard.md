# F5 — Dashboard and polling station wizard

Date: 2026-11-14

## Goal

Implement the host dashboard and polling station setup/edit wizard, including
draft persistence, candidate image uploads, validation, and launch confirmation.

## What was deleted

Nothing.

## Files created or changed

- Added the dashboard, station wizard, image uploader, and focused component and
  utility tests under `src/components/host/`, `src/lib/host/`, and
  `src/app/host/stations/`.
- Added shared station limits in `src/lib/shared/station-constants.ts`.
- Extended station API schemas and methods, MSW handlers, English translations,
  and global styles to support dashboard and wizard flows.
- Added `qrcode.react` and updated `package.json` and `pnpm-lock.yaml`.
- Updated `docs/screens.md` and this implementation-log index and entry.

## Decisions and deviations

- The requested `docs/api-reference.md` is absent. Used the available
  `docs/reference/api.md` as the API contract.
- Draft form state and the DRAFT station id are persisted in localStorage. Since
  the API does not expose a draft-delete endpoint, discarding removes browser
  progress but cannot delete an already-created server-side DRAFT station.
- The API/spec does not define a payment-required host field; the dashboard
  warning uses `host.plan === "PAYMENT_REQUIRED"` as an explicit assumption.
- A 10 MB candidate image limit is used because no upload file-size limit is
  defined by the API/spec. Images are center-cropped to a square with an
  800-pixel maximum dimension before direct Cloudinary upload.
- QR codes are generated with the approved `qrcode.react` dependency and only
  shown after successful launch.
- No files were deleted. No changes were needed outside the frontend.

## Commands run

- `pnpm add qrcode.react`
- `pnpm exec vitest run src/components/host/StationDashboard.test.tsx src/components/host/StationWizard.test.tsx src/components/host/ImageUploader.test.tsx src/lib/host/station-draft.test.ts src/lib/host/station-validation.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `git status --short`
- `git diff --check`

## Test results

- TypeScript: passed.
- ESLint: passed.
- Vitest: passed, 19 test files and 76 tests.
- Token check: passed.
- Translation check: passed (312 keys checked).
- Production build: passed. Next.js reports that the existing `middleware` file
  convention is deprecated in favor of `proxy`; the build is successful.
- `git diff --check`: passed.

## Manual steps

- Configure the API proxy target and Cloudinary upload credentials when testing
  against a live backend.
- Exercise the new, edit, discard, and launch flows against the backend to
  confirm its deployed API responses match the available frontend contract.
- A discarded server-side draft must be removed separately until a backend
  delete-draft endpoint is available.

## Open questions

- Should the backend add a delete-draft endpoint so discard removes the DRAFT
  station as well as local progress?
- What host account field and exact message key should indicate payment is
  required?
- What upload size limit should replace the frontend's provisional 10 MB cap?
- `docs/api-reference.md` is referenced by the request but absent; should the
  available `docs/reference/api.md` remain the canonical frontend API reference?
- The Next.js build warns that `src/middleware.ts` uses a deprecated convention.
  Should it be migrated to `src/proxy.ts` in a separately scoped change?
