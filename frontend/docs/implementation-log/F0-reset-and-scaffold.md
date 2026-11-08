# F0: Reset and scaffold

- Date: 2026-11-08
- Goal: Replace the legacy frontend with a clean Next.js App Router baseline.

## Deleted

- Removed `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `eslint.config.mjs`, `next.config.ts`, `package.json`, `package-lock.json`, `postcss.config.mjs`, `README.md`, and `tsconfig.json`.
- Removed the old `node_modules/`, `public/`, and `src/` directories.
- The removed legacy assets were `NACSO.png`, `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, and `src/app/favicon.ico`.
- The removed legacy source files were the home, admin login/dashboard, and voted pages; global CSS; layout; `Header.tsx`; `VotingSection.tsx`; and `src/lib/api.ts`.
- Preserved all existing content under `docs/`; no `.github/` or `.env*` files were present.
- No assets were requested for retention.

## Created or configured

- Scaffolded Next.js 16.4.5 with TypeScript, App Router, `src/`, Tailwind CSS v4, and the `@/*` alias.
- Added `.nvmrc`, `.editorconfig`, `.prettierrc`, `.gitignore`, `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, and `vitest.setup.ts`.
- Added `scripts/require-pnpm.mjs`, `scripts/check-tokens.mjs`, and `scripts/check-i18n.mjs`.
- Added `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/locales/en.json`, `src/components/PlaceholderPage.tsx`, its test, and MSW handler/server modules under `src/mocks/`.
- Added `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/screens.md`, `docs/implementation-log/README.md`, and this log.

## Decisions and deviations

- Used a temporary `scaffold-tmp/` directory because the preserved `docs/` directory meant the workspace root was not empty. It was moved into place and removed.
- The attempted hidden temporary directory name `.scaffold-tmp` was rejected by create-next-app; the non-hidden `scaffold-tmp` name succeeded.
- Backend integration is not implemented; `NEXT_PUBLIC_API_BASE_URL` is documented as a future setting and is not read by the placeholder.
- Removed the generated root README and `pnpm-workspace.yaml` to keep the frontend standalone and avoid retaining scaffold boilerplate.
- Changes needed outside frontend: none.

## Commands run

- `find . -print | sort`; `git status --short --untracked-files=all -- .`; `git ls-files --cached -- ...`
- `git rm -r -- ...`; removed the untracked old `node_modules/`
- `pnpm create next-app@latest .scaffold-tmp ...` (rejected because project names cannot start with a period)
- `pnpm create next-app@latest scaffold-tmp --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm --yes`
- Moved the generated scaffold into the workspace, removed its temporary directory, `.next/`, starter `public/`, and favicon.
- `pnpm add -D @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom msw prettier`
- `pnpm --version`; `node --version`; read installed Next.js App Router, fonts, and CSS guides
- `pnpm install --frozen-lockfile`; `pnpm format`; `pnpm run check:tokens`; `pnpm run check:i18n`
- `pnpm run preinstall`; `env npm_config_user_agent='npm/10.0.0' node scripts/require-pnpm.mjs`
- `pnpm typecheck`; `pnpm lint`; `pnpm test`; `pnpm build`
- `pnpm dev --hostname 127.0.0.1`; `curl ... http://127.0.0.1:3000/`; stopped the dev server after the smoke test
- Final `git status --short` and workspace file/lockfile checks

## Test results

- `pnpm install --frozen-lockfile`: passed with pnpm 12.4.1.
- `pnpm run preinstall`: accepted pnpm; npm user-agent simulation was rejected with exit code 1 and the expected message. No `npm` command was run.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed (1 test file, 1 test).
- `pnpm build`: passed; `/` and `/_not-found` generated.
- `pnpm dev` smoke test: `/` returned HTTP 200, rendered the localized placeholder, and returned the configured security headers.
- `pnpm run check:tokens` and `pnpm run check:i18n`: printed the requested F1 and F2 placeholders.

## Manual steps

- Run `pnpm install --frozen-lockfile` and `pnpm dev` from the frontend root.
- Add backend URL configuration and API calls when backend integration is implemented.

## Open questions

- What is the backend's local base URL and which API routes should the first integration use?
- Which screens and routes should be implemented after the reset?
