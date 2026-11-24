Date: 2026-11-24

## Goal

Build the Closed Vote and Public Poll voting journey, including ballot entry,
selection, review, submission, success, and public results states.

## Files created or changed

- Added `src/app/s/[publicId]/vote/page.tsx` for stored/manual Closed Vote entry
  and direct Public Poll ballot entry.
- Replaced the Public Poll ballot placeholder with the shared ballot experience.
- Added `src/app/s/[publicId]/success/page.tsx` and
  `src/app/s/[publicId]/results/page.tsx`.
- Added reusable ballot components to
  `src/components/voter/BallotExperience.tsx`.
- Added station-scoped ballot draft, ballot session, and results access helpers
  in `src/lib/voter/ballot-storage.ts`.
- Updated `src/lib/api/voting.ts` to allow an empty fingerprint fallback for
  Public Poll submissions.
- Added public vote, submit, and results MSW handlers.
- Added voter voting/result translations and mobile-first ballot styles.
- Updated `docs/screens.md`.

## Decisions and deviations

- A stored Closed Vote token is entered automatically; manual entry uses the
  existing `CodeField` and `PhoneField` primitives.
- One choice is maintained per category and persisted in station-scoped
  localStorage. Submitted selections and the draft are cleared after success.
- Ballot sessions are kept in sessionStorage and expire based on the API
  `expiresAt` value.
- Immediate results use a results access token kept in sessionStorage. Concealed
  results wait until the station closes.
- Public results derive leader and tie indicators from returned counts because
  the public results endpoint does not include host analytics tie flags.
- PDF export is not present and was not added because no approved client-side
  PDF dependency is available.
- No choices or ballot selections are written to analytics or logs.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm exec vitest run` for voter storage, ballot, success, and Public Poll tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `git status --short`

## Test results

- Ballot and storage focused tests: passed.
- Success, Public Poll duplicate/capacity, and draft clearing tests: passed.
- Full Vitest suite: passed (34 files, 173 tests).
- TypeScript check: passed.
- ESLint: passed.
- Token check: passed.
- i18n check: passed (591 keys).
- Production build: passed.

## Manual steps

- Test a stored-token Closed Vote ballot and manual token/phone entry.
- Verify every entry error state against the deployed API.
- Test all-position selection, abstain, review editing, and submission.
- Verify draft reload and clearing after success.
- Verify immediate and concealed result redirects and Public Poll labels.

## Open questions

- The public results response has no explicit tie metadata, so ties are derived
  by equal highest counts. This should be confirmed against backend aggregation
  semantics.
- Locked-token API wait time parameter names may differ; the UI accepts numeric
  `waitMinutes` or `minutes` params and otherwise shows the translated generic
  locked message.
