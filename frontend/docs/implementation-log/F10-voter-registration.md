Date: 2026-11-24

## Goal

Build the `/s/[publicId]` voter entry point and Closed Vote registration/status
journey, including registration, token storage, status polling, and translated
state screens.

## Files created or changed

- Added `src/lib/voter/voter-entry.ts` and its routing tests.
- Added `src/lib/voter/voter-token.ts` and its station-scoped storage tests.
- Added `src/components/voter/TokenDisplay.tsx`,
  `VoterRegistrationForm.tsx`, `VoterStateScreen.tsx`, and their tests.
- Updated `/s/[publicId]/page.tsx` with mode/status routing and state screens.
- Added `/s/[publicId]/status/page.tsx` and polling tests.
- Updated `/s/[publicId]/register/page.tsx` to render the Closed Vote form and
  lifecycle guards.
- Updated `src/lib/api/voting.ts` and public MSW handlers.
- Added voter strings to `src/locales/en.json`.
- Added mobile-first voter and token styles to `src/styles/globals.css`.
- Updated `docs/screens.md`.

## Decisions and deviations

- The entry point routes Closed Vote `REG_OPEN` to registration and `VOTE_OPEN`
  to the ballot. Closed registration, closed voting, cancelled, draft, and
  scheduled states use translated state screens.
- Public Poll routes only to the ballot while `VOTE_OPEN`; other states use
  matching state screens.
- The registration API sends the normalized canonical phone, device UUID, and
  fingerprint hash. An empty fingerprint remains supported by the API contract.
- The token is stored only in station-scoped localStorage and is cleared from
  component state as appropriate by route changes and page reload behavior.
- Status polling starts on open and every 30 seconds while the document is
  visible. A manual Check status action is also available.
- Web Share is used when available; otherwise the implementation falls back to
  clipboard copying or a translated copy failure.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm exec vitest run` for the focused voter routing, storage, token,
  registration, and status suites
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `git status --short`

## Test results

- Voter journey focused tests: passed (14 registration/storage/routing tests
  plus 7 status/token tests).
- Full Vitest suite: passed (31 files, 163 tests).
- TypeScript check: passed.
- ESLint: passed.
- Token check: passed.
- i18n check: passed (551 keys).
- Production build: passed.

## Manual steps

- Test registration on a real phone with a valid Malawi number.
- Verify the stored token survives reload and appears on `/status`.
- Verify pending, approved, rejected, revoked, already-registered, full,
  closed, rate-limit, and network-error states.
- Verify Web Share and clipboard behavior on supported and unsupported devices.
- Verify direct entry URLs for every station status.

## Open questions

- The API may return additional vote status keys beyond the common status
  states; unknown keys are currently displayed from the shared API message-key
  mechanism.
- Final voter ballot submission and live/final results pages remain separate
  from this registration journey.
