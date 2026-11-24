Date: 2026-11-24

## Goal

Complete the remaining section 7.7 screens and dialogs, add Billing, add a
payment gate, audit every inventory item, and verify route/navigation coverage.

## Files created or changed

- Added `src/app/host/billing/page.tsx` and `loading.tsx`.
- Added `src/components/host/BillingPage.tsx`.
- Added `src/components/host/PaymentGateDialog.tsx`.
- Added payment-gate integration to `StationWizard.tsx`.
- Added Billing links to desktop and mobile navigation.
- Added host and public document-title metadata.
- Added global `src/app/loading.tsx`.
- Added billing/provider translations and billing styles.
- Added `docs/screens-audit.md`.
- Updated `docs/screens.md`.
- Added billing, payment gate, and route smoke tests.
- Added route-level host/public loading and error shells.
- Added route document-title metadata across auth, legal, offline, maintenance,
  host, public, and component showcase routes.
- Added an MSW-backed pending-billing status test and billing status fetch.

## Decisions and deviations

- Payments remain disabled unless `NEXT_PUBLIC_ENABLE_PAYMENTS=true`.
- The beta-disabled state is rendered as a translated notice and the host can
  return to the dashboard.
- No `react-icons` package was added because the dependency list does not include
  it and no approved provider-icon dependency is present. Provider badges use
  translated text and existing styling.
- PayChangu integration endpoints are not documented in `docs/reference/api.md`,
  so the billing UI is ready for integration but does not invent API calls.
- The payment gate opens when launch returns a payment-required key or HTTP 402.
- The route smoke test validates every documented route file and renders the
  shared 404, 403, offline, and maintenance states.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm exec vitest run src/components/host/BillingPage.test.tsx src/components/host/PaymentGateDialog.test.tsx src/components/route-smoke.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `git status --short`

## Test results

- Billing, payment gate, and route smoke: passed (9 tests).
- Focused F12 billing/navigation/smoke suite: passed (16 tests).
- Final full Vitest suite: passed (38 files, 188 tests).
- TypeScript check: passed.
- ESLint: passed.
- Token check: passed.
- i18n check: passed (625 keys).
- Production build: passed.

## Manual steps

- Set `NEXT_PUBLIC_ENABLE_PAYMENTS=true` only after a PayChangu integration and
  approved backend payment endpoints are available.
- Verify premium monthly/annual products and Pay-per-use pricing with finance.
- Test payment gate behavior after launch receives a payment-required response.
- Verify provider badges and receipts in the target deployment.

## Open questions

- Exact PayChangu checkout, payment-status, and receipt endpoints were not in
  the API reference.
- Payment state transitions should use real backend state once payments are
  enabled.
