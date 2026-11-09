# F3 — Shared utilities

## Date

2026-11-09

## Goal

Bring phone normalization, token normalization, cryptographic formatting
helpers, constants, and schemas into the frontend; verify them against the
shared JSON contract vectors; and add reusable phone and token fields plus a
host phone-list hook.

## Files created or changed

- Added `src/lib/shared/constants.ts`, `phone-normalizer.ts`,
  `token-normalizer.ts`, `crypto.ts`, `schemas.ts`, and `index.ts`.
- Added `src/lib/shared.test.ts`, which reads and executes all cases from
  `docs/test-vectors/phone-normalizer.json`,
  `docs/test-vectors/token-normalizer.json`, and
  `docs/test-vectors/hash-formats.json`.
- Added reusable `src/components/ui/PhoneField.tsx` and
  `src/components/ui/CodeField.tsx` over `M3TextField`, with field tests in
  `src/components/ui/shared-fields.test.tsx`.
- Added `src/lib/host/use-phone-list.ts` and its test.
- Added translated phone preview and code helper strings to
  `src/locales/en.json`.
- Added `docs/shared-sync.md`, updated `docs/screens.md`, the `format` script in
  `package.json`, and the implementation-log index.
- Created this implementation log.

## Decisions and deviations

- The requested `docs/reference/backend-shared/` source tree was absent from
  the frontend workspace. After asking for direction, the utilities were
  reconstructed from the frontend specification and JSON vectors. They are
  not claimed as a byte-for-byte copy, and behavior not represented by the
  specification or vectors cannot be proven identical to the backend.
- No dependencies were added. Cryptographic operations use Web Crypto; the
  existing Zod dependency is used for shared schemas.
- Phone list parsing treats line breaks, commas, and semicolons as separators
  and preserves each non-empty entry for callers to classify.
- All supplied JSON vectors passed unchanged. No vector or expected result was
  modified.
- No changes were made outside the frontend workspace.

## Commands run

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `pnpm exec vitest run src/lib/shared.test.ts src/components/ui/shared-fields.test.tsx src/lib/host/use-phone-list.test.tsx`
- `pnpm exec vitest run src/components/ui/shared-fields.test.tsx`
- `git status --short`

## Test results

- TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: passed, 11 test files and 52 tests.
- All phone normalization, token normalization, and hash-format JSON vectors
  passed.
- Token check: passed.
- i18n check: passed, 26 literal translation calls checked.
- Production build: passed. Next.js emitted the existing middleware-to-proxy
  deprecation warning.
- The first vector-test run exposed a test path resolution issue, which was
  corrected to resolve the JSON fixtures from the frontend workspace root.
  The full final suite passed.

## Manual steps

- When an approved backend shared-source snapshot is available, provide it
  inside the frontend workspace and refresh the corresponding files as
  described in `docs/shared-sync.md`.
- Review any backend behavior not represented in the vectors before treating
  this reconstruction as fully behaviorally equivalent.

## Open questions

- Exact backend implementation parity remains unverified because the
  requested shared-source snapshot was unavailable.
- The contract does not define whether every valid international number should
  have a WhatsApp URL or specify all phone-list delimiters; the implementation
  follows the supplied expected cases and documents its list separator choice.

## Changes needed outside frontend

None.
