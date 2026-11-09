# F0 — Reset and scaffold

## Date

2026-11-08

## Goal

Replace the previous frontend application with a clean Next.js App Router
starter, keeping `docs/` and adding the requested development, testing, and
localization foundations.

## What was deleted

After approval, removed the existing root `scripts/` and `src/` trees, `.next/`,
`node_modules/`, root configuration files, package manifests and lockfile, the
old README, and old public SVG boilerplate. The initial root files included
`.editorconfig`, `.gitignore`, `.nvmrc`, `.prettierrc`, `AGENTS.md`,
`eslint.config.mjs`, `next.config.ts`, `package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `tsconfig.json`, and Vitest configs/setup. The removed
source included the old page, styles, component, locale, mocks, and test.

The approved keep paths were honored. `docs/` and its references, prompts,
designs, test vectors, and project specification were preserved. No `.github/`
or root `.env*` files were present; no assets were specified to keep. Scaffold
logos and sample SVGs were removed.

## Files created or replaced

- Next.js scaffold/config: `package.json`, `pnpm-lock.yaml`, `next.config.ts`,
  `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `.nvmrc`,
  `next-env.d.ts`, and the Next-generated `AGENTS.md`.
- Tooling: `.editorconfig`, `.prettierrc`, `scripts/require-pnpm.mjs`,
  `scripts/check-tokens.mjs`, `scripts/check-i18n.mjs`, `vitest.config.mts`,
  and `vitest.setup.ts`.
- App: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`,
  `src/components/PlaceholderPage.tsx`,
  `src/components/PlaceholderPage.test.tsx`,
  `src/components/require-pnpm.test.ts`, and `src/locales/en.json`.
- MSW: `src/mocks/handlers.ts` and `src/mocks/server.ts`.
- Documentation: `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/screens.md`,
  and `docs/implementation-log/README.md`.

The create-next-app workspace file and app-level README were removed; this is a
single frontend package, not a workspace. The generated `public/` directory
contains no boilerplate assets.

## Decisions and deviations

- Scaffolded Next.js 16.4.5 (latest stable returned by create-next-app) with
  pnpm 12.4.1; `packageManager` is set to `pnpm@12.4.1`, and Node is constrained
  to `>=22`.
- Used Next.js Google font optimization for Commissioner, Tailwind CSS v4, a
  strict TypeScript configuration with `noUncheckedIndexedAccess`, Vitest with
  React/jsdom, Testing Library, and MSW.
- The home route is intentionally a simple localized placeholder. No old
  application text, styles, or components were copied.
- The Cloudinary image allowlist and baseline response security headers are
  configured. Backend rewrites remain unconfigured for F2.
- Check scripts print `implemented in F1` and `implemented in F2`; they are
  placeholders by request.
- `docs/DEVELOPMENT.md` documents `NEXT_PUBLIC_API_BASE_URL` as an example
  using port 8787. The placeholder does not consume it; replace that URL with
  the backend's actual local URL when integrating.
- Changes needed outside frontend: none.

## Commands run

- `find . -print | sort` and root-only inventory commands.
- `git status --short -- .`, `git ls-files`, and package manager version check.
- `pnpm create next-app@latest . --ts --eslint --tailwind --app --src-dir --import-alias '@/*' --use-pnpm --yes`
- `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom msw prettier`
- `pnpm install --no-frozen-lockfile`
- `pnpm format`
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm run check:tokens` and `pnpm run check:i18n`
- Simulated the npm install lifecycle user agent by running
  `scripts/require-pnpm.mjs` with `npm_config_user_agent=npm/11.0.0`; it exited 1
  and printed the pnpm-only message. Also tested the pnpm user agent in Vitest.
- `pnpm dev`, then `curl http://localhost:3000/`; the page returned the
  placeholder text. The development server was stopped afterward.

## Test results

- `pnpm install --frozen-lockfile`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 2 test files and 3 tests.
- `pnpm build`: passed; `/` and `/_not-found` generated.
- `pnpm dev` smoke test: passed; returned “The frontend placeholder is ready.”
- npm guard simulation: passed; rejected npm with exit code 1.
- `check:tokens` / `check:i18n`: scripts ran and printed the expected F1/F2
  placeholder messages.
- No `package-lock.json`, `npm-shrinkwrap.json`, or `yarn.lock` is present.

## Manual steps

- Use Node.js 22+ and pnpm 12.4.1 (or install the specified package manager
  version) before working in the frontend.
- Create `.env.local` only when needed and set the actual backend base URL;
  restart the frontend after changing it. It is not consumed yet.
- Start the backend separately using its own development instructions when
  beginning API integration.

## Open questions

- Confirm the backend's local base URL before F2 wires frontend API requests.
- Product screens and route requirements remain for later feature work; F0 only
  records the placeholder `/` route.
