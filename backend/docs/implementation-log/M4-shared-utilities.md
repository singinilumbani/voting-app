# M4 Shared Utilities

- **Date:** 2026-10-17
- **Goal:** Add reusable, framework-free phone, token, constants, schemas, and message-key utilities under `src/shared/`, using only Web APIs and no imports from other backend folders.

## Files created or changed

- `src/shared/constants.ts`: the configurable Malawi mobile-number assumption and specification section 11.1 defaults, caps, lockout values, and attempt limits.
- `src/shared/schemas.ts`: Zod schemas and inferred TypeScript types for shared enums, phone/token result unions, and common station, category, candidate, registration, and voter-status DTOs.
- `src/shared/messages.ts`: typed error and status message-key constants.
- `src/shared/phone/normalize-phone.ts`: phone cleanup, Malawi canonicalization, international validation, WhatsApp URL creation, and phone-list extraction/fixing/deduplication.
- `src/shared/token/token.ts`: secure Crockford token generation, token input normalization, station-scoped HMAC-SHA-256 hashing, and constant-time string comparison.
- `src/shared/index.ts`: public barrel exports.
- `src/shared/phone/normalize-phone.test.ts`, `src/shared/token/token.test.ts`, `src/shared/shared.test.ts`: shared utility and schema tests. Phone and token normalizer tests read the JSON vectors below.
- `docs/test-vectors/phone-normalizer.json`, `docs/test-vectors/token-normalizer.json`: portable test vectors for frontend parity.
- `docs/implementation-log/M4-shared-utilities.md`: this record.
- `docs/api.md` was not changed because these utilities add no endpoint.

## Decisions and deviations

- The phone-number prefix rule is exposed as `PHONE_NUMBER_RULE`; it remains the specification's assumption pending confirmation against Malawi's official numbering plan.
- Malawi numbers with an explicit country code normalize to the same canonical digits and local display as national input; other explicitly international numbers retain their country digits, display with a leading `+`, and set `isInternational: true`.
- A repeated Malawi country code is rejected as `NOT_MOBILE`; Excel scientific notation is detected before punctuation removal and flagged as `SPREADSHEET_DAMAGED`.
- Phone-list `valid` and `fixed` entries have `{ original, result }` shape; `needsAttention` entries have `{ original, reason }`. `fixed` includes entries whose extracted input differs from canonical/display form. Duplicate valid entries are omitted after the first and counted in `duplicatesMerged`.
- The token `TK` prefix is stripped only when the compact input has a prefix plus 12 payload characters. This avoids mistaking a legitimate raw 12-character token beginning with `TK` for its display prefix.
- `constantTimeEqual` compares UTF-8 byte sequences across the maximum input length and incorporates the length difference in the accumulated result.
- No dependencies were added. `src/shared/` imports only sibling shared files and Zod; token cryptography uses Web Crypto, randomness uses `crypto.getRandomValues`, and phone formatting uses standard JavaScript APIs.
- One patch command accidentally targeted a malformed absolute path containing a leading space in the parent component. The tool reported creating `/home/Leo/Desktop/Legacy/ voting-app/backend/src/shared/phone/normalize-phone.test.ts`, which is outside the allowed workspace and is not part of the Git worktree. It was not inspected, edited, or removed due the strict scope rule. It requires manual cleanup outside this workspace. The correctly scoped test file is `backend/src/shared/phone/normalize-phone.test.ts`.
- No intentional files were created or changed outside `backend/`.

## Commands run

- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend exec prettier --write "src/shared/**/*.ts" "src/shared/*.ts" "docs/test-vectors/*.json"` — passed.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend typecheck` — passed.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend lint` — passed.
- `pnpm --dir /home/Leo/Desktop/Legacy/voting-app/backend test` — passed.
- `git -C /home/Leo/Desktop/Legacy/voting-app/backend status --short` — run for the final scoped worktree check; all reported paths are backend-relative, with no `../` path.

## Test results

- Strict TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: 60 passed, 3 skipped. The skipped tests are the PostgreSQL integration tests requiring database configuration; shared utility tests all ran.
- Phone vectors cover all prompt examples, local formats, international formats, invisible characters, short/long input, landline, scientific notation, empty values, invalid characters, and repeated country code.
- Token vectors cover display and raw formats, case/spacing, ambiguity mapping, incorrect lengths, invalid symbols, and raw payloads beginning with `TK`.

## Manual steps for me

- Manually remove the accidentally created out-of-workspace file at `/home/Leo/Desktop/Legacy/ voting-app/backend/src/shared/phone/normalize-phone.test.ts`; it was deliberately left untouched under the strict scope restriction.
- Confirm the 9-digit mobile-number rule (numbers beginning with 8 or 9) against the official numbering plan.

## Open questions

- The actual official Malawi mobile-number prefix/length rule remains unconfirmed as noted in specification section 11.4.
- The prompt does not specify whether international `display` values should be formatted according to each country's national conventions. This implementation uses `+` followed by canonical digits for other countries.

## Changes needed outside backend

- Manual cleanup is needed for the accidental out-of-workspace file `/home/Leo/Desktop/Legacy/ voting-app/backend/src/shared/phone/normalize-phone.test.ts`. No command was run against that path after it was created.
