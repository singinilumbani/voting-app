# F4 — Landing and host authentication

## Date

2026-11-14

## Goal

Build the public landing page and the host sign-in, signup, password recovery,
verification, and profile-management flows using the existing design system and
typed API client.

## Files created or changed

- Replaced the scaffold homepage in `src/app/page.tsx` with
  `src/components/auth/LandingPage.tsx`, including poll-link parsing in
  `src/lib/poll-link.ts`.
- Added `src/components/auth/AuthDialog.tsx` and `src/components/auth/types.ts`
  for sign-in, two-step signup, account-tier notices, validation, password
  strength, and verification-aware redirects.
- Added `src/components/auth/AuthPages.tsx` and
  `src/components/auth/LegalPlaceholder.tsx`.
- Added App Router pages for `/host`, `/host/profile`, `/forgot-password`,
  `/check-email`, `/reset-password`, `/reset-success`,
  `/reset-link-expired`, `/verify-email-pending`, `/verify-email`,
  `/verify-email-verified`, `/verification-link-expired`, `/terms`, and
  `/privacy`.
- Added `src/components/host/HostPages.tsx` for the session-protected host
  landing and profile, including profile/password updates, tier changes,
  export, and typed confirmation for downgrade and deletion.
- Updated `src/lib/api/client.ts` to optionally preserve successful response
  status and `src/lib/api/auth.ts` to use HTTP 202 as the authoritative
  verification-required signal.
- Expanded auth endpoint mocks in `src/mocks/handlers.ts`.
- Added translations and exact spec notice/empty-state strings in
  `src/locales/en.json`; added responsive landing/auth/profile styles in
  `src/styles/globals.css`.
- Added tests in `src/components/auth/auth.test.tsx`,
  `src/components/host/profile.test.tsx`, and `src/lib/poll-link.test.ts`;
  extended `src/lib/api/client.test.ts`.
- Updated `docs/screens.md`, the implementation-log index, and created this
  log.

## Decisions and deviations

- The requested `docs/api-reference.md` was absent. The available
  `docs/reference/api.md` was used for API contracts.
- The API reference documents verification via signup HTTP 202, but provides
  no resend-verification endpoint. The pending page shows a cooldown and a
  disabled resend control with an explanation; no undocumented endpoint was
  invented.
- The email-verification pending flow is entered only when signup returns
  HTTP 202 or profile update returns `verificationRequired: true`. Successful
  signup (HTTP 201) goes directly to `/host`.
- Temporary/Long-Term notices and the dashboard empty-state sentence match the
  specification text exactly.
- Terms and Privacy routes are intentionally placeholders; complete legal
  copy is not included in the frontend references.
- The host dashboard provides the required redirect destination and empty
  state. Station setup itself remains outside this task.
- MSW remains opt-in through `NEXT_PUBLIC_ENABLE_MOCKS`; when disabled, the
  existing configured proxy/direct API client calls the real API.
- No dependencies or files outside the frontend workspace were changed.

## Commands run

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `pnpm exec vitest run src/components/auth/auth.test.tsx src/components/host/profile.test.tsx src/lib/poll-link.test.ts src/lib/api/client.test.ts`
- `pnpm exec vitest run src/components/host/profile.test.tsx`
- `git status --short`
- `git diff --check`

## Test results

- TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: passed, 14 test files and 64 tests.
- Token check: passed.
- i18n check: passed, 186 translation calls checked with no hard-coded JSX
  warnings.
- Production build: passed; 19 App Router routes generated.
- Next.js emitted the existing middleware-to-proxy deprecation warning.
- Focused coverage exercises both exact tier notices, signup validation and
  success, verification-required routing, translated sign-in errors, forgot
  and reset flows, poll-link parsing, and tier downgrade confirmation.

## Manual steps

- Set `NEXT_PUBLIC_ENABLE_MOCKS=true` in the frontend `.env.local` to use MSW
  auth and public-station mocks. Disable it to use the configured proxy/direct
  API mode.
- Provide production Terms of Use and Privacy Policy content before public
  launch.
- Add a resend-verification API endpoint before enabling a working resend
  action; the control is intentionally disabled until the contract exists.

## Open questions

- What endpoint and request shape should support resending email verification?
- What should `/host` link to when the station setup wizard is implemented?
- The policies are placeholders; the approved legal copy and destination
  ownership remain to be supplied.

## Changes needed outside frontend

None.
