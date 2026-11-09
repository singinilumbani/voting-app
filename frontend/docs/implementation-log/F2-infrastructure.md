# F2 — Frontend infrastructure

## Date

2026-11-09

## Goal

Implement the frontend infrastructure for translations, typed API access,
React Query, session handling, application shells, global UX, environment
validation, and API mocks.

## Files created or changed

- Added translation dictionary and `useT()` / `getT()` helpers with
  interpolation, plural forms, and development missing-key warnings.
- Added Zod environment validation, API response schemas, credentialed fetch
  and error mapping, endpoint-group clients, and Server Component cookie
  forwarding under `src/lib/`.
- Added React Query defaults, visibility-aware polling, the session hook and
  logout helper, and the `/host/*` cookie-presence guard.
- Added host and voter layout shells, navigation, global offline and
  session-expiry UX, and 404, 403, 500, maintenance, and offline screens.
- Added MSW auth and public-station-config handlers, browser worker setup, and
  the generated `public/mockServiceWorker.js`.
- Added translation, API error mapping, polling, shell, and middleware tests.
- Updated `next.config.ts`, package dependencies/configuration, i18n checking,
  root providers, `docs/DEVELOPMENT.md`, and `docs/screens.md`.
- Updated `docs/implementation-log/README.md` and created this log.

## Decisions and deviations

- The requested `docs/api-reference.md` and
  `docs/reference/backend-shared/messages.ts` were not present in the frontend.
  Following approval, `docs/reference/api.md` was used for API contracts and
  available error/status keys. No backend files were inspected or changed.
- Added the approved `@tanstack/react-query` dependency; Zod was already
  present.
- MSW starts only when `NEXT_PUBLIC_ENABLE_MOCKS=true`; unhandled requests pass
  through. `API_PROXY_TARGET` remains server-only, and the proxy uses Next.js
  rewrites.
- The requested `src/middleware.ts` is retained. Next.js 16.4.5 builds it as a
  Proxy but prints a deprecation warning recommending `src/proxy.ts`; changing
  the filename would depart from the explicit requested path.
- No changes were needed outside the frontend workspace.

## Commands run

- `pnpm format`
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- `node --input-type=module -e '…'` to compare API-reference error/status keys
  with `src/locales/en.json`
- `date +%F`
- `git status --short`

## Test results

- Frozen-lockfile install: passed.
- TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: passed, 8 test files and 38 tests.
- Token check: passed.
- i18n check: passed, 24 translation calls checked.
- Production build: passed. Next.js emitted the expected middleware deprecation
  warning noted above.
- The API-reference comparison found no missing explicit `errors.*` or
  `status.*` keys.

## Manual steps

- Set the desired API mode and target in the frontend `.env.local`; use
  `API_PROXY_TARGET` for proxy mode or `NEXT_PUBLIC_API_URL` for direct mode.
- Set `NEXT_PUBLIC_ENABLE_MOCKS=true` and restart the dev server to use the
  browser MSW handlers; disable it to use the configured API.
- Confirm the local API origin and its cookie/CORS configuration when testing
  against the backend.

## Open questions

- Should the explicitly requested `src/middleware.ts` be migrated to
  `src/proxy.ts` in a later task to remove the Next.js 16 deprecation warning?
- The unavailable shared backend message file could not be used as the
  canonical complete message catalog; confirm whether `docs/reference/api.md`
  is the intended frontend source of API message keys.

## Changes needed outside frontend

None.
