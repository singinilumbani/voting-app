# Shared utility synchronization

`src/lib/shared/` contains the frontend's local copy of the backend's
`src/shared/` utilities. Keep phone normalization, token normalization,
cryptographic formats, constants, and schemas behaviorally aligned between the
two applications.

## Refreshing the frontend copy

When an approved backend shared-source snapshot is available inside this
frontend workspace:

1. Replace the corresponding files in `src/lib/shared/` with that snapshot.
2. Make only the import-path and TypeScript configuration adjustments needed
   for this frontend. Do not introduce frontend dependencies into the shared
   utility code.
3. Run `pnpm test -- src/lib/shared.test.ts` to compare the implementation
   against every JSON vector.
4. Run `pnpm typecheck`, `pnpm lint`, and the full required checks before
   merging.
5. If any vector fails, preserve the vector and behavior report it in the
   implementation log; do not make a silent vector or algorithm change.

## Contract vectors

The JSON files in `docs/test-vectors/` are the cross-application contract:
`phone-normalizer.json`, `token-normalizer.json`, and `hash-formats.json`.
Frontend unit tests read and execute every case from these files. Update the
vectors only through an explicitly coordinated contract change so both
applications continue to produce compatible results.

## Source limitation for F3

The requested `docs/reference/backend-shared/` source snapshot was not present
in this workspace when F3 began. The current `src/lib/shared/` implementation
was reconstructed from the frontend specification and contract vectors, at the
user's direction; exact source-level or unrepresented behavior parity remains
unverified until the backend snapshot is supplied.
