Date: 2026-11-24

## Goal

Add frontend CI/deployment templates and documentation, add a frontend uptime
health route, and verify proxy/build behavior as far as the real backend permits.

## Files created or changed

- Added `ci/github-workflows/frontend-ci.yml`.
- Added `src/app/api/health/route.ts`.
- Added `docs/DEPLOYMENT.md`.
- Added `docs/RELEASE.md`.
- Updated `docs/screens.md`.

## Decisions and deviations

- The workflow stays inside the frontend workspace under
  `ci/github-workflows/` and is not copied into a repository-level `.github/`
  directory.
- CI is pull-request-only for `frontend/**`, uses Node 22 and pnpm 12.4.1, and
  does not run Playwright.
- The health route is static JSON and never calls the backend.
- Production build placeholder values are non-secret.
- Vercel Ignored Build Step is documented with `git diff HEAD^ HEAD --quiet --
  frontend`; exit 0 skips, exit 1 builds.
- No deployment or DNS change was made.

## Changes needed outside frontend

- Copy `ci/github-workflows/frontend-ci.yml` to
  `.github/workflows/frontend-ci.yml` at the repository root.
- Create the Vercel project and environment variables manually.

## Proxy verification

- The existing `next.config.ts` rewrites `/api/v1/:path*` to
  `API_PROXY_TARGET` in proxy mode.
- The API client and server fetch use the same origin in proxy mode.
- Set-Cookie passthrough is delegated to Next.js/Vercel response proxying; no
  frontend code rewrites or removes `Set-Cookie`.
- This session could not reach the backend health endpoint in localhost, so
  live cookie and rewrite verification against a real beta Worker remains a
  manual step.

## Commands run

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm check:i18n`
- `pnpm build`
- Production backend reachability check against local API origin
- `git status --short`

## Test results

- Unit, type, lint, i18n, token, and build checks pass in the closing run.
- Live proxy and Set-Cookie verification could not run without a reachable
  backend started by the user.
- Production `/api/health`: passed locally with HTTP 200 and JSON
  `{"status":"ok","buildTime":"development"}`.
- Production `/api/v1/health`: returned HTTP 500 because no local beta backend
  was reachable; live Set-Cookie passthrough remains unverified.

## Manual steps

1. Copy the workflow file to `.github/workflows/frontend-ci.yml`.
2. Create the Vercel project with `frontend` as Root Directory.
3. Set production branch to `dev`.
4. Configure beta environment variables and the beta Worker URL.
5. Set the Vercel Ignored Build Step command.
6. Start the beta backend and run:
   `pnpm build && pnpm start`.
7. Verify `/api/health`, `/api/v1/health`, host login cookies, and API proxy
   headers with the real beta backend.

## Open questions

- The exact beta Worker URL and custom domain are not yet provisioned.
- Vercel project and team limits can change; verify current Hobby and build
  limits at deployment time.
