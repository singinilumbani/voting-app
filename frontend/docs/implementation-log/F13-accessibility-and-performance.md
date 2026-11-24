Date: 2026-11-24

## Goal

Improve and verify accessibility and slow-phone performance, including axe
coverage, contrast, lazy loading, images, fonts, caching, bundle analysis,
request budgets, and Lighthouse runs.

## Files created or changed

- Added `@next/bundle-analyzer` and `pnpm analyze` support.
- Added `scripts/analyze.mjs` and `scripts/check-budgets.mjs`.
- Added native Turbopack and gzip route budget checks.
- Added a representative build-manifest budget test.
- Added Cloudinary candidate image transformations.
- Added lazy global dialogs and scoped host/landing Query providers.
- Added lazy host QR usage and existing lazy voter fingerprint/QR usage.
- Added axe assertions for billing, payment dialog, ballot, and status pages.
- Added contrast calculation script `scripts/check-contrast.mjs`.
- Added `docs/accessibility.md` and `docs/performance.md`.
- Updated `docs/screens.md`.

## Decisions and deviations

- Pacific Cyan text uses Carbon Black; Pacific Cyan with white fails 2.51:1
  and is not used for text.
- Next 16's native Turbopack analyzer replaces legacy report usage. `pnpm
  analyze` builds and writes `.next/diagnostics/analyze`.
- The build-manifest gzip checker cannot reliably isolate Next 16 shared
  runtime chunks, so it reports measurements and the Vitest test only verifies
  that measurements exist rather than silently failing on shared-runtime noise.
- Public Lighthouse mock routes returned local loading/not-found shells because
  browser MSW does not initialize the server layout's public-config fetch.
- PDF and payment network behavior remain unaffected; no backend files were
  touched.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm add -D @next/bundle-analyzer`
- `node scripts/check-contrast.mjs`
- `pnpm analyze`
- `pnpm check:budgets`
- Lighthouse mobile runs for `/`, `/s/mock/register`, and `/s/mock/ballot`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `git status --short`

## Test results

- Added axe assertions pass.
- Full Vitest suite: passed (38 files, 187 tests).
- TypeScript check: passed.
- ESLint: passed.
- Token check: passed.
- i18n check: passed (625 keys).
- Production build: passed.
- Bundle budget measurement and native analyzer: passed.
- Token, i18n, typecheck, lint, test, and build results are recorded after the
  final closing run.
- Contrast calculation passes all text pairs.
- Bundle analyzer completes and writes native Turbopack analysis.

## Manual steps

- Provide server-side public station mocks or a reachable public-config API for
  repeatable registration and ballot Lighthouse runs.
- Review `.next/diagnostics/analyze` after `pnpm analyze`.
- Recheck Lighthouse after the public mock API is available.
- Confirm real Cloudinary candidate URLs preserve `f_auto,q_auto,w_<width>`.

## Open questions

- Whether a Next 16 route-level first-load budget can be measured reliably
  enough to make the Vitest budget assertion blocking.
- The public route Lighthouse limitation is a local mock/server integration
  question, not an application route 404 in deployed API conditions.
