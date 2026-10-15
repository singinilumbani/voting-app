# M1 Backend Tooling and pnpm Migration

- **Date:** 2026-10-15
- **Goal:** Configure strict TypeScript and backend tooling, migrate this backend to pnpm, and document the developer workflow without changing application behavior.
- **Scope:** Backend workspace only. Legacy JavaScript and application behavior are to remain unchanged. No application-data migration is in scope.

## Legacy dependency baseline

Recorded from the direct dependencies in the original dependency lockfile before changing project files:

| Dependency | Resolved version | Kind |
| --- | --- | --- |
| `bcrypt` | `6.0.0` | dependency |
| `cloudinary` | `1.41.3` | dependency |
| `cookie-parser` | `1.4.7` | dependency |
| `cors` | `2.8.6` | dependency |
| `dotenv` | `18.0.1` | dependency |
| `express` | `5.2.1` | dependency |
| `express-rate-limit` | `8.7.0` | dependency |
| `helmet` | `8.3.0` | dependency |
| `jsonwebtoken` | `9.0.3` | dependency |
| `multer` | `2.4.0` | dependency |
| `multer-storage-cloudinary` | `4.0.0` | dependency |
| `pg` | `8.23.0` | dependency |
| `nodemon` | `3.1.14` | devDependency |

## Migration record

### Decisions and deviations

- Applied the audit answers: discard legacy administrators, positions, candidates and votes without migration; use one host account per tenant with isolated polling stations; ship Public Poll and Closed Vote; preserve ballot secrecy with no voter/device-to-choice link or per-vote timestamps; enforce the approved Malawi phone rule and international-number support; use the approved UUID/hash/duplicate/disclosure/purge policy; require Workers without changing frameworks absent approval; target Vercel, Workers and Neon staging while leaving the live Vercel project untouched; retain the 50,000 ceiling and 2,500 recommendation pending load testing; defer host email verification and PayChangu and leave provider/hash choices open.
- `pnpm import` succeeded with the installed pnpm `12.4.1`. The imported versions for all 12 direct dependencies and `nodemon` matched the baseline above; no legacy application dependency was changed.
- Added TypeScript `5.9.3`, ESLint `9.39.5`, Vitest `4.1.11`, Wrangler `4.151.0`, `typescript-eslint` `8.71.2`, `@types/node` `22.20.5`, and the supporting lint/format packages. The latest TypeScript release was not supported by typescript-eslint, so TypeScript 5.9 was selected. ESLint 10 and Vitest 5 required a later Node 22 minor than the requested general `>=22` engine, so compatible major versions were used.
- pnpm 12 requires lifecycle-script approvals in `pnpm-workspace.yaml`; it no longer reads this setting from `package.json`. That file is inside this backend and approves only the inspected `bcrypt`, `core-js`, `esbuild`, and `workerd` build scripts. It does not define additional package directories or a multi-package repository.
- TypeScript's `baseUrl` option was removed in TypeScript 7. The required `@/*` alias is configured with the relative `./src/*` target and no `baseUrl`.
- Existing JavaScript application code and behavior were not changed. ESLint is configured to lint legacy CommonJS without applying TypeScript-only rules to it; unused caught exception variables in the existing JS are ignored rather than editing those files.
- `dev:worker` and the Wrangler config are present, but the config names the planned `src/worker.ts` entrypoint, which is not added here. This follows the approved tooling-only scope; the Workers runtime spike must establish an Express adapter/entrypoint before `dev:worker` can serve the application.
- No API endpoints changed. `docs/api.md` documents the current legacy endpoints, including legacy vote response fields that conflict with the specification's secrecy rules; this tooling task does not change application behavior.
- No legacy peer-dependency setting was present. No hoisting override was added.

### Files created

- `.editorconfig`, `.nvmrc`, `.prettierrc`, `eslint.config.mjs`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/require-pnpm.mjs`, `tsconfig.json`, `vitest.config.ts`, and `wrangler.jsonc`.
- `docs/README.md`, `docs/DEVELOPMENT.md`, `docs/api.md`, `docs/build-prompts/README.md`, `docs/implementation-log/README.md`, and this log.

### Files changed

- `package.json`, `.gitignore`, `docs/legacy-audit.md`, `docs/implementation-log/M0-repository-audit.md`, and the existing backend build-prompt document. The latter was edited surgically to update old command references while retaining its module content.
- Existing JavaScript files, `docs/project-specification.md`, and frontend files were not edited.

### Files removed

- Removed the original lockfile and `node_modules` directory inside the backend, as authorized. No shrinkwrap or alternate lockfile existed.

### Search results and external scope

- A token-aware search for the requested old package-manager commands, lockfile names, and config-file reference found no standalone matches in backend scripts, configuration, or documentation. The raw substring search lists `scripts/require-pnpm.mjs`, `docs/DEVELOPMENT.md`, `docs/implementation-log/M0-repository-audit.md`, this log, `docs/build-prompts/copilot_backend_build_prompts.md`, `docs/legacy-audit.md`, and `docs/project-specification.md`; all are intentional pnpm references because the old command-name letters occur inside `pnpm`. They are not legacy commands. The project specification is unchanged.
- **Changes needed outside backend:** the M0 audit identified old development-command examples in `frontend/README.md` and legacy manager ignore patterns in `frontend/.gitignore`; the frontend's original lockfile also remains. These paths were left untouched as required. M0 found no root CI/deployment configuration to update. No outside files were inspected or edited during M1.

### Commands run

- `pnpm -v` — `12.4.1`.
- `pnpm import` — succeeded.
- `pnpm add --save-dev ...` — installed the tooling packages but initially exited because pnpm blocked dependency lifecycle scripts. After reviewing the four scripts and configuring the narrow allowlist, `pnpm install` completed successfully.
- `pnpm view ...` — checked Node engine compatibility for the tool versions.
- `pnpm typecheck` — initially exposed TypeScript 7 config/API incompatibility; passed after switching to TypeScript 5.9 and correcting the relative alias target.
- `pnpm lint` — initially exposed TypeScript rules applied to legacy JS and its unused caught errors; passed after limiting TypeScript rules to TypeScript files and accounting for existing catch variables without source edits.
- `pnpm test` — passed; no test files exist yet (`--passWithNoTests`).
- `pnpm build` — passed.
- `pnpm format` — passed and formatted only TypeScript and root tooling/configuration files; the legacy JavaScript was not formatted.
- `rm -rf node_modules && pnpm install --frozen-lockfile` — passed from a clean backend install state; the guard ran successfully.
- Guard simulation using `npm_config_user_agent=npm/10.0.0 ... node scripts/require-pnpm.mjs` — returned exit status 1 and the expected actionable message. The alternate package-manager executable itself was not run.
- `timeout 8s pnpm dev` — nodemon launched `node index.js` and the server remained running until the validation timeout.
- Final `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` — all passed; the test runner reported no test files and exited successfully.
- Final token-aware search — zero standalone legacy package-manager or lockfile references in the backend. The extra checks for old lockfile wording, package-runner references, and config wording also returned no matches. A literal substring search necessarily flags pnpm documentation and is noted above.
- `git status --short` — could not run because the backend workspace has no Git metadata visible to the command (`fatal: not a git repository`). Every created/changed path in this task was rooted inside the backend; no `../` path was reported or used.

### Test results

- Clean frozen install: passed.
- Typecheck: passed.
- Lint: passed.
- Test: passed; no test files exist yet.
- Build: passed.
- Existing backend startup via `pnpm dev`: passed; it stayed running until the validation timeout.
- Alternate package-manager guard behavior: passed by simulating its lifecycle user-agent.
- Runtime note: command output identifies the active Node runtime as `26.8.2`, not the requested Node 22 LTS. The project metadata targets Node >=22 and `.nvmrc` specifies 22; rerun the checks under Node 22 before merge.

### Manual steps

- Use Node.js 22 LTS and pnpm `12.4.1` or newer.
- Supply the existing application's required environment variables before using database-backed routes.
- Do not use `dev:worker` as a working backend deployment until the runtime spike implements and verifies the Worker entrypoint and Express compatibility.
- Before merging, update the frontend's package-manager instructions/ignore rules in its own workspace if desired; this task intentionally did not touch it.

### Open questions

- The existing Express/`pg`/native `bcrypt` implementation has not been proven compatible with Cloudflare Workers. The approved follow-up is a runtime spike; framework changes require a separate decision.
- The legacy vote endpoint and schema expose a voter-to-choice relationship and per-vote timestamps. Replacing them with the approved secret ballot model is application work outside this tooling migration.
- No load test, Neon connection, Cloudflare deployment, email provider selection, or password-hashing redesign was performed.
