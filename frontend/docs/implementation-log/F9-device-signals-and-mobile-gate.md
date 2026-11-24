# F9 — Device signals and mobile gate

Date: 2026-11-24

## Goal

Add per-station voter device identifiers, lazy ThumbmarkJS fingerprints,
privacy notices, and a server/client mobile-only gate under `/s/[publicId]`.

## Files created or changed

- Added `src/lib/voter/device-id.ts` and `src/lib/voter/use-device-id.ts`.
- Added `src/lib/voter/use-fingerprint.ts` with a dynamic ThumbmarkJS import.
- Added `src/lib/voter/mobile-gate.ts` with UA/client-hint classification.
- Added `src/components/voter/` context, privacy notice, mobile gate, and
  lazy-QR mobile-required screen.
- Added `/s/[publicId]`, registration, and ballot routes.
- Added the public station server fetch cache to
  `src/lib/api/public-station-config.ts`.
- Added F9 voter and gate tests.
- Updated translations, voter styles, and `docs/screens.md`.

## Decisions and deviations

- Layer 1 lives in `src/app/s/[publicId]/layout.tsx`, not middleware. The layout
  fetches the public station config once with a 30-second revalidation interval
  and shares the station data through a voter context.
- The layout never gates the host dashboard.
- `Sec-CH-UA-Mobile=?1` and mobile UA families permit passage. `?0`, Windows,
  X11, CrOS, and plain Linux classify as desktop. Macintosh is ambiguous and
  unknown agents pass through.
- Desktop or ambiguous results run Layer 2 with `navigator.maxTouchPoints > 0`
  and `(pointer: coarse)`. Both checks are required to pass.
- The mobile gate is friction, not security, because browser signals can be
  unavailable or spoofed.
- ThumbmarkJS is dynamically imported only by registration and Public Poll
  ballot pages. It does not load on host pages and its failures return `""`.
- The device UUID is restored from localStorage, a first-party cookie, or
  IndexedDB. The first surviving value is replicated across the available
  storage layers.
- New voter routes are intentionally lightweight placeholders; no voter API
  requests were added outside the layout's cached public station config.

## Changes needed outside frontend

- None.

## Commands run

- `pnpm add @thumbmarkjs/thumbmarkjs`
- `pnpm exec prettier --write`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `pnpm exec vitest run src/lib/voter/mobile-gate.test.ts src/components/voter/MobileOnlyGate.test.tsx src/lib/voter/device-id.test.ts src/lib/voter/use-fingerprint.test.ts`
- `git status --short`
- `git diff --check`

## Test results

- TypeScript check: passed.
- ESLint: passed.
- Focused F9 device and mobile-gate tests: passed (15 tests).
- Full Vitest suite: passed (26 files, 145 tests).
- Token check: passed.
- i18n check: passed with 527 keys.
- Production build: passed after removing the route-level revalidate export;
  Cache Components-compatible fetch caching remains set to 30 seconds.
- `git diff --check`: passed.

## Manual steps

- Test `/s/[publicId]` on a real phone and desktop.
- Verify `mobileOnly: false` bypasses the gate and `mobileOnly: true` blocks
  desktop pointers.
- Verify device UUID restoration after clearing localStorage, cookies, or
  IndexedDB one layer at a time.
- Confirm the ThumbmarkJS package loads only on registration and ballot pages.

## Open questions

- The final registration and ballot submissions are not yet implemented.
- The public layout requires the public station endpoint to be reachable under
  the configured proxy or direct API base.
