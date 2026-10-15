# Backend Build Prompts for GitHub Copilot (Agent Mode)

Malawian Digital Vote Hosting & Analytics Platform, based on Project Specification Version 3.0 (beta scope).

This file has three jobs:

1. Part 1 lists everything you must do by hand before and during the build (pulling the repo, creating the local databases, accounts, secrets).
2. Part 2 is the working loop to follow with every prompt.
3. Part 3 is a set of modular prompts (M0 to M14). Paste one at a time into Copilot Chat in **Agent mode**.

Assumptions to check before you start:

- The repository root contains two folders named `backend/` and `frontend/`. If yours are named differently (for example with a space or a hyphen), search and replace the names in this file before using it.
- The existing code is the church voting app. It is being extended, not thrown away. Prompt M0 audits it first, so nothing here assumes how it is built.
- This pack covers the **back end only**. A front-end prompt pack comes after the Stitch UI designs exist.
- Package manager: **pnpm only**. Language: **TypeScript (strict)**. Every prompt repeats this so Copilot does not drift.
- The project was set up with npm. Prompt M0 inventories every trace of npm, and prompt M1 migrates the whole repository (backend, frontend, scripts, CI, Vercel settings, docs) to pnpm so that no npm or yarn usage remains.

---

## Part 1. One-time manual setup (you do these)

### 1.1 Check your tools

Node.js, pnpm, PostgreSQL and pgAdmin 4 are already installed. Just confirm they respond:

| Tool | Check command |
| --- | --- |
| Git | `git --version` |
| Node.js (the project targets 22 LTS) | `node -v` |
| pnpm | `pnpm -v` |
| PostgreSQL client | `psql --version` (if it is not found, use pgAdmin 4 in step 1.5) |
| VS Code with GitHub Copilot and Copilot Chat | Copilot icon in the status bar, Chat mode set to Agent |
| GitHub CLI (optional) | `gh --version` |

If your Node version is older than 22, update it before module M1 (the prompts pin Node 22 in `.nvmrc`).

### 1.2 Create the accounts

- **GitHub:** you need push access to the voting-app repo, or a fork you own.
- **Cloudflare** (free): for Workers. Later you will run `pnpm wrangler login` from `backend/`.
- **Neon** (free): create a project named `vote-platform-staging` with a database named `staging_db`. Choose the region nearest to Malawi that Neon offers (usually Europe). Copy the connection string (it ends with `sslmode=require`). Do this before module M13, not now.
- **Cloudinary** (free): note the cloud name, API key and API secret. All uploaded assets go into the Cloudinary folder named `voting-app` (create it in the Media Library if it does not exist). The folder name is a setting, so you can change it for production later.
- **Vercel:** create a **new** project later for the platform front end. Do not touch the Vercel project that serves the current voting-app.
- **Later, not now:** a transactional email provider for host emails (Brevo free tier is a good first choice), and a domain.

### 1.3 Pull the repository safely

The existing voting-app may be live. Protect it first.

```text
git clone https://github.com/<owner>/voting-app.git
cd voting-app
git status
git branch -a
git log --oneline -5
```

Authentication: if Git asks for a password, sign in with the browser prompt from Git Credential Manager, or run `gh auth login`.

Before changing anything:

1. Find out what deploys from `main` (check Vercel and GitHub Actions). **Never push directly to `main` during this project.**
2. Tag the current state so you can always return to it:

```text
git tag voting-app-v1
git push origin voting-app-v1
```

3. Create the integration branch the spec calls `dev`:

```text
git checkout -b dev
git push -u origin dev
```

4. In GitHub, go to Settings, Branches, and add a protection rule for `main` (require pull requests) and, if you like, for `dev`.

### 1.4 Create the documentation folder and save the spec

All documentation lives in one place: `backend/docs/`. Create it by hand now, with this layout:

```text
backend/docs/
  README.md                      index of the folder (module M1 writes it if you skip it)
  project-specification.md       the Version 3.0 spec
  build-prompts/                 this prompt file, plus any per-module prompt files
  implementation-log/            one file per module, written by Copilot after each module
  legacy-audit.md                created by M0
  api.md                         endpoint reference, updated by every module
  runtime-spike.md               created by M2
  security-checklist.md          created by M11
  load-test-plan.md              created by M12
  DEVELOPMENT.md                 created by M1
  DEPLOYMENT.md                  created by M13
```

Then:

1. Open the Version 3.0 spec doc and export it as Markdown (or Word, then convert).
2. Save it as `backend/docs/project-specification.md`.
3. Save this prompt file as `backend/docs/build-prompts/copilot-backend-build-prompts.md`.
4. Commit them on a feature branch (see the loop in Part 2).

Copilot reads files in your workspace, so keeping the spec and the prompts inside the repo lets you attach them with `#file:`.

### 1.5 Create the local databases

PostgreSQL is already running, so you only need a user and two databases (the spec names them `vote_app_dev` and `vote_app_test`). Do not reuse any database the existing voting-app uses.

**Option A: pgAdmin 4 (no commands)**

1. Open pgAdmin 4 and connect to your local server.
2. Right-click **Login/Group Roles**, then Create, then Login/Group Role. On the General tab name it `vote_user`. On the Definition tab set a password. On the Privileges tab turn on **Can login**.
3. Right-click **Databases**, then Create, then Database. Name it `vote_app_dev` and set the owner to `vote_user`.
4. Repeat for `vote_app_test`.

**Option B: psql**

```text
psql -U postgres
```

Then, inside psql:

```text
CREATE USER vote_user WITH PASSWORD 'choose-a-password';
CREATE DATABASE vote_app_dev OWNER vote_user;
CREATE DATABASE vote_app_test OWNER vote_user;
\q
```

Test the connection (psql, or the pgAdmin Query Tool after connecting as `vote_user`):

```text
psql "postgresql://vote_user:choose-a-password@localhost:5432/vote_app_dev" -c "select 1"
```

If your PostgreSQL does not listen on port 5432, change the port in the connection strings in step 1.6.

### 1.6 Environment files and secrets

Create these files by hand. They must never be committed (module M1 adds them to `.gitignore`; check it yourself with `git status` before every commit).

Generate each secret with:

```text
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`backend/.env.local` (used by Node scripts, migrations and tests):

```text
APP_ENV=development
DB_DRIVER=pg
DATABASE_URL=postgresql://vote_user:choose-a-password@localhost:5432/vote_app_dev
TEST_DATABASE_URL=postgresql://vote_user:choose-a-password@localhost:5432/vote_app_test
TOKEN_HMAC_SECRET=<generated secret 1>
SESSION_SECRET=<generated secret 2>
ENABLE_EMAIL_VERIFICATION=false
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
COOKIE_DOMAIN=
PASSWORD_HASH_ITERATIONS=100000
CLOUDINARY_CLOUD_NAME=<from Cloudinary>
CLOUDINARY_API_KEY=<from Cloudinary>
CLOUDINARY_API_SECRET=<from Cloudinary>
CLOUDINARY_UPLOAD_FOLDER=voting-app
EMAIL_PROVIDER=console
EMAIL_FROM=no-reply@example.com
BREVO_API_KEY=
```

`backend/.dev.vars` (the same values, used by `wrangler dev`; Workers read local secrets from this file, not from `.env.local`).

Later, for the beta Worker, secrets are set with `pnpm wrangler secret put NAME` (module M13).

### 1.7 Set up Copilot

1. In VS Code Copilot Chat, switch the mode selector to **Agent**.
2. Create `.github/copilot-instructions.md` with the content in section 1.8 (Copilot loads it for every chat).
3. When you start a prompt, attach the spec with `#file:backend/docs/project-specification.md`.

### 1.8 Contents of `.github/copilot-instructions.md`

```text
# Project rules for Copilot

Project: multi-tenant voting platform for Malawi (Polling Stations, Public Poll and Closed Vote modes). The authoritative requirements are in backend/docs/project-specification.md. If a prompt and the spec disagree, stop and ask me.

Repository layout: pnpm workspace with backend/, frontend/ and packages/shared (@vote/shared).

Hard rules:
- Use pnpm only. Never run or suggest npm, npx or yarn. Translate any instruction that uses them: npm install -> pnpm install, npm run X -> pnpm run X, npm ci -> pnpm install --frozen-lockfile, npx X -> pnpm dlx X (or pnpm exec X for locally installed binaries). Never create or commit package-lock.json, npm-shrinkwrap.json or yarn.lock. Never use shamefully-hoist without asking me.
- TypeScript strict. No `any` unless commented with a reason. Validate all external input with zod.
- Backend uses an OOP layered design: Controllers (HTTP only) -> Services (business rules) -> Repositories (SQL only). Services depend on interfaces injected through constructors.
- Services and repositories must be runtime-portable: use Web Crypto (crypto.subtle, crypto.getRandomValues, crypto.randomUUID), fetch and URL. Do not use Node-only APIs or native modules (no bcrypt) outside src/server.ts.
- Backend must run on Node locally and on Cloudflare Workers (free plan: 10 ms CPU per request). Keep request handlers light.
- Never log tokens, phone numbers, names, passwords or secrets.
- All user-facing text is a message key (for example "errors.station.locked"), never English text in API responses or components.
- Timestamps are stored in UTC.
- Ballot secrecy: the cast_votes table must never contain a voter reference or a timestamp, and no code may join votes to voters.
- Every change needs tests (vitest). Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before declaring work done.
- Do not add dependencies outside this list without asking: express, cors, zod, drizzle-orm, drizzle-kit, pg, @neondatabase/serverless, vitest, supertest, tsx, tsup, wrangler, eslint, prettier, typescript.
- Never run destructive commands (rm -rf outside build folders, git push --force, dropping databases other than vote_app_test) without asking.
- Create or edit files only inside backend/ unless the prompt's SCOPE RULE names other paths. Never touch frontend/ source files, root files, .github/ or packages/ unless the prompt's SCOPE RULE explicitly allows it. If a change outside the allowed scope seems necessary, do not make it; write it in the implementation log and ask me.
- All documentation lives in backend/docs/. Never create documentation files anywhere else. After finishing every module, write an implementation log to backend/docs/implementation-log/M<number>-<short-name>.md.
```

### 1.9 GitHub issues

Create one GitHub issue per module (M0 to M13). The issue number goes into the branch name, as in the spec: `feature/#12-station-api`.

---

## Part 2. The working loop (every prompt)

1. `git checkout dev && git pull`
2. `git checkout -b feature/#<issue>-<short-name>`
3. Open a **new** Copilot Chat (Agent mode). The prompts live in `backend/docs/build-prompts/`. Attach `#file:backend/docs/project-specification.md` and, if it exists, `#file:backend/docs/legacy-audit.md`.
4. Paste the prompt exactly as it is in Part 3. Every prompt already ends with its own closing instructions (checks, API reference update, implementation log), and the larger modules (M1, M2, M3, M6, M8) already ask the agent for a plan first. You do not add anything.
5. For the plan-first modules, read the plan, correct it if needed, and reply "approved" before the agent edits files.
6. Read the diff (`git diff --stat`, then the files). Run `git status --short` yourself and check that every path starts with `backend/`. The only expected exceptions are the root `pnpm-lock.yaml` (changed by pnpm), the root tooling and `packages/shared` in M1, `packages/shared` in M4, and `.github/workflows` in M13. If anything else changed, discard it (`git restore <path>` for tracked files, delete untracked files) before committing. If the agent drifts, discard and start a new chat.
7. Read the new file in `backend/docs/implementation-log/`, then commit in small steps, push, open a pull request into `dev`, merge. Commit the implementation log with the code.

---

## Part 3. The prompts

### M0. Repository audit (read-only)

```text
SCOPE RULE (strict): You may read anything, but you may create only the two files named below, both inside backend/docs/. Do not create or edit anything else, anywhere.

You are working in the existing voting-app repository (a church voting web app) that is being extended into a multi-tenant voting platform described in backend/docs/project-specification.md. Package manager is pnpm, language is TypeScript.

Do NOT modify any existing file. Do not run install, build or migration commands. The only files you may create are backend/docs/legacy-audit.md and backend/docs/implementation-log/M0-repository-audit.md (the implementation log).

Audit the repository and write your findings into backend/docs/legacy-audit.md:
1. Top-level structure. Confirm the folders backend/ and frontend/ exist.
2. Package manager and Node: every lockfile (package-lock.json, npm-shrinkwrap.json, yarn.lock, pnpm-lock.yaml) and where it is, every package.json (root, backend, frontend, any other), the packageManager and engines fields, any .npmrc or .nvmrc, and whether each package is TypeScript or JavaScript. Then a complete npm usage inventory: every place that calls npm, npx or yarn (package.json scripts, shell scripts, README and docs, GitHub Actions, Vercel settings files, Dockerfiles, git hooks, Makefiles), every undeclared (phantom) dependency you can detect by comparing imports with declared dependencies, and any peer dependency overrides such as legacy-peer-deps.
3. Backend: framework, entry points, routes, auth approach, database engine, ORM or query layer, tables and columns, environment variables, scripts.
4. Frontend: framework and version, router type, pages, styling approach, state management, how it calls the API, environment variables.
5. Deployment and CI: anything that deploys from main (Vercel config, GitHub Actions), and any hard-coded URLs.
6. Tests: what exists and how they run.
7. Risks: committed secrets, outdated or vulnerable dependencies, anything that would conflict with the spec (for example password storage, vote storage that links voters to ballots).
8. A table mapping each existing feature to the closest feature in the spec, with a recommendation: reuse, refactor, or remove later.
9. A numbered list of questions I must answer before restructuring.

Write the implementation log to backend/docs/implementation-log/M0-repository-audit.md (date, goal, what you inspected, key findings, open questions). Do not run tests or any other command that changes files. Before finishing, run `git status --short` and confirm the only new files are the two named above. Finish by printing the numbered questions and wait for my answers.
```

### M1. Monorepo and tooling

```text
SCOPE RULE (strict): Outside backend/, you may touch ONLY these: (1) the root tooling files created in tasks 1 and 2; (2) packages/shared/**; (3) the root pnpm-lock.yaml, generated by pnpm; (4) frontend/package.json, and only to add the workspace dependency on @vote/shared and to replace npm, npx or yarn commands with pnpm ones; (5) deleting package-lock.json, npm-shrinkwrap.json, yarn.lock and node_modules directories; (6) replacing npm, npx and yarn commands with pnpm ones in README files, CI workflows, Dockerfiles, git hooks and Makefiles. Do not edit any other file in frontend/ (no source files, no other config). Inside backend/ you may edit whatever the migration needs. For anything else outside backend/, do not change it: list it under "Changes needed outside backend" in the implementation log.

Read backend/docs/legacy-audit.md and the answers I give below. Set up monorepo tooling.
Rules: pnpm only (never npm or yarn), TypeScript strict, Node 22 LTS.

My answers to the audit questions:
<PASTE YOUR ANSWERS HERE>

Tasks:
1. Root: private package.json with the packageManager field, pnpm-workspace.yaml (backend, frontend, packages/*), .nvmrc (22), tsconfig.base.json (strict, noUncheckedIndexedAccess, target ES2022, moduleResolution Bundler), shared ESLint flat config and Prettier config, .editorconfig.
2. .gitignore must cover: .env*, .dev.vars, .wrangler, dist, coverage, node_modules.
3. Migrate the whole repository from npm to pnpm so that no npm or yarn usage remains:
   a. Before touching anything, record the current resolved top-level version of every dependency from each package-lock.json in backend/docs/implementation-log/M1-monorepo-tooling.md.
   b. Try `pnpm import` (it converts an existing package-lock.json into pnpm-lock.yaml). If it cannot cover every package, run a fresh `pnpm install` and compare the resolved versions with the recorded ones. Pin any version drift that could change behavior.
   c. Delete every package-lock.json, npm-shrinkwrap.json and yarn.lock, and delete every node_modules directory, then reinstall with `pnpm install`. These are the only deletions you may make.
   d. pnpm does not hoist undeclared dependencies. When the app or a build fails because a package is missing, add it to the correct package.json with `pnpm add`. Never use shamefully-hoist or public-hoist-pattern without asking me first. Replace any legacy-peer-deps setting with a correct pnpm configuration.
   e. Replace every npm run, npm install, npm ci, npm test, npx and yarn command in package.json scripts, shell scripts, README and docs, GitHub Actions, Dockerfiles, git hooks and Makefiles with the pnpm equivalent (pnpm run, pnpm install, pnpm install --frozen-lockfile, pnpm test, pnpm exec or pnpm dlx).
   f. Add a pnpm-only guard: a root `preinstall` script that runs scripts/require-pnpm.mjs (no new dependency), which exits with a clear error when process.env.npm_config_user_agent does not start with "pnpm". Set the packageManager field to the exact installed pnpm version (run `pnpm -v`) and engines to node >=22 and pnpm >= that major version in the root package.json.
   g. Vercel: remove any custom install or build command that mentions npm. Vercel detects pnpm from pnpm-lock.yaml and the packageManager field. Do not change settings you cannot see; list in the log what I must check in the Vercel dashboard.
   h. Search the whole repo for the strings "npm ", "npx ", "package-lock", "yarn" and ".npmrc" and put the results in the log. None may remain in scripts, CI, config or docs, except inside a third-party package name or file.
4. Create packages/shared as @vote/shared (TypeScript, built with tsup, ESM plus types, vitest configured). It only needs an index file for now.
5. Make backend and frontend depend on @vote/shared with workspace:*.
6. Root scripts: dev:backend, dev:frontend, typecheck, lint, test, format (using pnpm -r or --filter).
7. Do not change application behavior, do not delete legacy code, and do not edit frontend source files. If a package is JavaScript, leave it as is. New code will be TypeScript.
8. Create the documentation layout under backend/docs/: README.md (an index explaining every file and folder), build-prompts/ and implementation-log/ (each with a short README.md), and DEVELOPMENT.md explaining install, run and test commands for the whole repo. Do not overwrite project-specification.md or anything already in build-prompts/.

Done when: from a clean clone (no node_modules), `pnpm install --frozen-lockfile`, `pnpm typecheck` and `pnpm lint` run without new failures (list any failures that already existed); running `npm install` is refused with the guard's error message; no package-lock.json, npm-shrinkwrap.json or yarn.lock exists anywhere in the repo; the existing backend and frontend both still start with pnpm; and the search in task 3h is clean.

First reply with a short plan and the list of files you will create or change. Wait for my approval before editing anything.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M1-monorepo-tooling.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M2. Backend skeleton and runtime spike

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: create the new backend skeleton in backend/ using Express and TypeScript in an OOP layered structure, runnable on Node (local) and on Cloudflare Workers (wrangler dev), and prove it with a runtime spike.
Read spec sections 3.1, 3.3, 3.7 and 12.2. Read backend/docs/legacy-audit.md for anything that already exists in backend/. Keep legacy code runnable; put new code in the structure below, and tell me if the two collide.

Structure under backend/src:
- app.ts: createApp(deps) returns the Express app.
- server.ts: Node entry for local development (the only file allowed to use Node-only APIs).
- worker.ts: Cloudflare Workers entry that runs the same Express app through Cloudflare's Node.js HTTP compatibility. Read the current Cloudflare documentation for the exact helper and flags.
- config/env.ts: zod-validated configuration that works with both process.env and Workers bindings.
- core/: AppError subclasses, global error handler, request id, logger with redaction, common types.
- middleware/: cors (origins from CORS_ORIGINS), security headers, body size limit, validate(zod) helper, placeholders for auth and rate limiting.
- modules/: empty folders with a README each for auth, stations, registration, voting, analytics, jobs.
- container.ts: a simple manual dependency injection container.

Rules:
- Controllers only parse, validate and respond. Services hold business rules. Repositories hold SQL only.
- Services and repositories use Web Crypto, fetch and URL only.
- API base path is /api/v1. GET /api/v1/health returns { status, env, time }.
- Error responses look like { error: { key, params?, requestId } } where key is a message key such as "errors.validation.failed". Never return English sentences.

Spike tasks:
- Add wrangler.toml (nodejs_compat flag, current compatibility date) and backend/.dev.vars.example.
- Scripts: `pnpm --filter backend dev` (Node) and `pnpm --filter backend dev:worker` (wrangler dev).
- Verify /api/v1/health works in both runtimes.
- Run `wrangler deploy --dry-run` and record the bundle size.
- Write backend/docs/runtime-spike.md: what worked, versions, flags, bundle size, limits you hit, and a recommendation.
- If Express cannot run reliably on Workers, do NOT switch frameworks. Describe how to move the controllers to Hono while keeping services and repositories unchanged, then stop and wait for me.

First reply with a short plan and the list of files you will create or change. Wait for my approval before editing anything.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M2-backend-skeleton.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M3. Database layer and schema

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: build the database layer with Drizzle ORM and PostgreSQL. Read spec sections 4.9, 9 and 12.2.

Requirements:
1. Drizzle schema files, one per table, under backend/src/db/schema, plus drizzle-kit migrations under backend/src/db/migrations.
2. Tables (UUID primary keys, UTC timestamps):
   - users: username (unique), password_hash, email (unique), account_type (TEMPORARY | LONG_TERM), plan (FREE | PAY_PER_USE | PREMIUM), last_login_at, email_verified_at, purge_at, created_at.
   - sessions and password_reset_tokens (hashed tokens, expiry, used_at).
   - polling_stations: public_id (unguessable short id used in links; the UUID stays internal), host_id, name, description, mode (PUBLIC_POLL | CLOSED_VOTE), status (DRAFT, REG_OPEN, REG_CLOSED, VOTE_OPEN, VOTE_CLOSED, ARCHIVED, CANCELLED), results_visibility (IMMEDIATE | CONCEALED), allow_abstain, mobile_only, voter_cap, is_launched, reg_starts_at, reg_ends_at, vote_starts_at, vote_ends_at, closed_at, created_at.
   - categories (station, title, display_order) and candidates (category, name, cloudinary_image_url, created_at, updated_at).
   - registered_voters (Closed Vote check-in table): station, full_name, phone_number (normalized, UNIQUE per station), approval_status (PENDING | APPROVED | REJECTED | REVOKED), rejection_reason, registration_attempts, blocked, token_hash, failed_attempts, locked_until, device_fingerprint_hash, client_device_uuid, ip_hash, flag_reason, has_voted, voted_at (stored truncated to the minute), registered_at, approved_at.
   - device_records (Public Poll): station, client_device_uuid (UNIQUE per station), device_fingerprint_hash, has_voted.
   - cast_votes: id (random UUID), polling_station_id, category_id, candidate_id (nullable, null means Abstain). NO voter reference, NO device reference, NO timestamp.
   - activity_log (station events: candidate added or edited, approvals, rejections, revocations, token reissues; no vote data).
   - payments (table only; unused during beta).
3. Add check constraints and indexes: voter_cap between 2 and 50000, unique (polling_station_id, phone_number), unique (polling_station_id, client_device_uuid), index on (polling_station_id, token_hash), index on (polling_station_id, approval_status).
4. DbClient factory: DB_DRIVER=pg uses node-postgres locally and in tests; DB_DRIVER=neon uses @neondatabase/serverless with the WebSocket Pool (needed for interactive transactions and row locks). On Workers, create the connection per request and close it, never cache it across requests. Expose withTransaction(fn).
5. A BaseRepository class and one repository per table or aggregate (SQL only).
6. Scripts: db:generate, db:migrate, db:seed (a demo host, one Closed Vote station and one Public Poll station), db:reset (refuses to run unless APP_ENV=development or test), and test helpers that migrate and truncate vote_app_test.
7. Tests: an introspection test that fails if cast_votes ever gains a column referencing voters or devices, or any timestamp column; constraint tests for phone uniqueness and voter cap.

Do not write any business logic in this task.

First reply with a short plan and the list of files you will create or change. Wait for my approval before editing anything.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M3-database-layer.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M4. Shared package: phone normalizer, token utilities, constants

```text
SCOPE RULE (strict): Create or edit files ONLY inside packages/shared/ and backend/ (backend/package.json may gain the @vote/shared dependency). The root pnpm-lock.yaml may change only as a side effect of running pnpm commands. Never touch frontend/, .github/ or any other root file. If you think another change is needed, list it under "Changes needed outside scope" in the implementation log.

Goal: build the pure, dependency-free utilities in packages/shared (@vote/shared). Read spec sections 4.3, 4.4 and 11.1. Everything here is used by both the backend and the front end, so use Web APIs only.

1. Phone normalizer (normalizePhone):
   - Clean: remove spaces, dashes, dots, brackets, invisible characters, a leading "tel:", and a leading "+".
   - Rewrite to canonical digits 265 + 9-digit national number: "0991234567", "0991 234 567", "099-123-4567", "+265 99 123 4567", "00265991234567", "265991234567", "991234567" (a leading zero dropped by a spreadsheet) and "+2650991234567" (extra zero after the country code) all become "265991234567".
   - Validate: national number is 9 digits starting with 8 or 9 (mobile). This rule is configuration (an exported constant) because it is an assumption.
   - Return a discriminated result: { ok: true, canonical, display (like "0991 234 567"), whatsappUrl (https://wa.me/<canonical>), isInternational } or { ok: false, reason } where reason is one of TOO_SHORT, TOO_LONG, NOT_MOBILE, SPREADSHEET_DAMAGED (for values like 9.91E+11), EMPTY, INVALID_CHARACTERS.
   - Numbers with an explicit + or 00 and another country code are accepted if they have 8 to 15 digits and are marked isInternational.
   - Also export parsePhoneList(text) that splits on new lines, commas, semicolons and tabs, extracts the number from lines like "Mary 0991234567", normalizes each, de-duplicates after normalization and returns { valid, fixed (original and result), needsAttention (with reason), duplicatesMerged }.
2. Token utilities:
   - generateVoterToken(): 12 characters from the Crockford base32 alphabet (0123456789ABCDEFGHJKMNPQRSTVWXYZ) using crypto.getRandomValues (mask each byte with 31, no modulo bias), formatted as TK-XXXX-XXXX-XXXX.
   - normalizeTokenInput(input): uppercase, strip spaces, dashes and the TK prefix, map O to 0 and I or L to 1, validate length 12 and alphabet.
   - hashToken(secret, stationId, normalizedToken): HMAC-SHA256 through crypto.subtle, hex output. Plus a constant-time compare helper.
3. Constants (single source of truth, from spec section 11.1): registration window min 1 h, max 24 h, default 12 h; voting window min 15 min, max 24 h, default 12 h; voter cap min 2, default 500, max 50000, recommended free-tier limit 2500; Public Poll ballot ceiling default 2500; token lockout 5 attempts and 15 minutes, flag at 10; rejected re-registration attempts 3; voting start within 7 days of registration closing.
4. Shared zod schemas and TypeScript types for enums and common DTOs, and a message key constants file (errors.*, status.*).
5. Table-driven unit tests for every example above and for edge cases (empty, letters, too long, double country code, Excel scientific notation). Aim for full coverage of this package.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M4-shared-package.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M5. Host accounts and authentication

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement host accounts. Read spec sections 6.1 to 6.4, 3.5, 12.2 and 12.3. Use the layered structure and the repositories from M3.

Endpoints under /api/v1/host/auth:
- POST signup: username, password, email, accountType (TEMPORARY | LONG_TERM), termsAccepted (must be true). Returns the session. The two tier notices are shown by the front end, so return only the account type.
- POST login, POST logout, GET me.
- POST forgot-password and POST reset-password. Responses are neutral so they cannot reveal which emails exist. Reset tokens are random, stored hashed, single use and expire in 1 hour.
- PATCH profile (username, email), POST change-password.
- POST change-tier. Upgrading TEMPORARY to LONG_TERM is allowed. Downgrading requires { confirm: "DELETE" } because stored data then follows the 7-day purge rule.
- POST export-data and DELETE account (typed confirmation in the body).

Rules:
- Session: random id stored hashed in the sessions table, delivered as an HttpOnly, Secure, SameSite=Lax cookie (Domain from COOKIE_DOMAIN, empty locally). Add a requireHost middleware.
- Password hashing must fit the Workers 10 ms CPU limit. Implement a PasswordHasher interface with a PBKDF2-SHA256 implementation using Web Crypto and a configurable iteration count (PASSWORD_HASH_ITERATIONS). Store the algorithm, iterations and salt with the hash so it can be upgraded later. Add a benchmark script and note the measured time in backend/docs/runtime-spike.md. Do not use bcrypt or any native module.
- ENABLE_EMAIL_VERIFICATION: when false, signup logs the host in immediately and email_verified_at stays null. When true, send a verification link and block login until verified.
- EmailService interface with ConsoleEmailService (prints to the log, default) and BrevoEmailService (HTTP API through fetch, selected by EMAIL_PROVIDER). Templates are keyed by message key with placeholders. Emails are for hosts only. No code path may send email to a voter.
- Set users.purge_at for TEMPORARY accounts and record last_login_at on every login.
- Rate limit login and forgot-password attempts per IP and per username (use a RateLimiter interface with an in-memory implementation now; M11 adds the production one).
- Tests: signup, duplicate username and email, login failure messages that do not reveal which field was wrong, tier change rules, reset flow, flag behavior for email verification.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M5-host-auth.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M6. Polling station management API

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement the host-side station and setup wizard API. Read spec sections 4.1, 4.2, 4.8, 7.3, 7.6 and 11.1. Use the constants from @vote/shared.

1. StationLifecycle class (pure, unit tested) with allowed transitions and guards:
   - Public Poll: DRAFT -> VOTE_OPEN -> VOTE_CLOSED -> ARCHIVED.
   - Closed Vote: DRAFT -> REG_OPEN -> REG_CLOSED -> VOTE_OPEN -> VOTE_CLOSED -> ARCHIVED.
   - Any state before VOTE_CLOSED can go to CANCELLED. Cancelling after VOTE_OPEN requires { confirm: "CANCEL" }.
   - Scheduling is derived, not a separate state: Closed Vote REG_CLOSED with a future vote_starts_at means "voting scheduled"; Public Poll DRAFT with is_launched and a future vote_starts_at means "scheduled". The scheduler (M10) opens voting at vote_starts_at.
2. Endpoints under /api/v1/host/stations (all check that the host owns the station):
   - POST create (Step 0: name, description, mode, results_visibility, allow_abstain, mobile_only) and PATCH update (allowed only in DRAFT).
   - Categories: create, rename, reorder, delete (DRAFT only).
   - Candidates: create, edit (name, picture) and delete. Delete only in DRAFT. In REG_OPEN, allow create and edit only. In every other status, candidates are locked. Log every create and edit in activity_log.
   - POST uploads/sign: returns a Cloudinary signed upload payload (cloud name, API key, timestamp, signature, folder taken from the CLOUDINARY_UPLOAD_FOLDER setting, default voting-app). Compute the signature with Web Crypto. Only allowed when candidate changes are allowed.
   - PUT registration-config (Closed Vote, DRAFT only): voter_cap (the Estimated Voter Count), registration duration in hours (1 to 24, default 12). Rejects out-of-range values with message keys.
   - PUT voting-config: start now or a scheduled start no later than 7 days after registration closes (Public Poll: within 7 days of launch), duration 15 minutes to 24 hours (default 12).
   - POST launch: validates at least 1 category and at least 2 candidates per category and all configuration. Closed Vote moves to REG_OPEN and sets reg_starts_at and reg_ends_at. Public Poll sets is_launched and opens voting now or at the scheduled time. Returns the share link data (public_id).
   - POST extend-registration (REG_OPEN only, total window may not exceed 24 hours), PATCH voter-cap (REG_OPEN only, may only increase, within 50000).
   - POST start-voting (Closed Vote, REG_CLOSED): returns a warning payload with the pending count before confirming, then sets vote_starts_at and vote_ends_at.
   - POST cancel, GET list (with filters All, Active, Scheduled, Past and search), GET detail, GET activity-log.
3. Public read endpoint GET /api/v1/public/stations/:publicId returning only what a voter's browser needs: name, mode, status, window times, mobile_only, allow_abstain, results_visibility, and candidates when the ballot may be shown.
4. Enforce the free-tier guard: when voter_cap is above the recommended 2500, accept it but return a warning key so the front end can show the notice.
5. Tests: every lifecycle transition (allowed and forbidden), candidate rules per status, window validation boundaries, ownership checks.

First reply with a short plan and the list of files you will create or change. Wait for my approval before editing anything.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M6-station-api.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M7. Closed Vote registration and approval API

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement voter registration and the host approval queue. Read spec sections 4.2, 4.3, 4.4, 4.5 and 5.1. Use normalizePhone, generateVoterToken and hashToken from @vote/shared.

Public endpoints under /api/v1/public:
- POST stations/:publicId/register: body { fullName, phone, deviceUuid, fingerprintHash }. Station must be Closed Vote and REG_OPEN. Normalize the phone (invalid numbers return the reason key). One registration per phone per station. Cap logic: pending plus approved registrations count against voter_cap; when full, return errors.registration.full. A duplicate phone returns errors.registration.alreadyRegistered with guidance to contact the host. A previously REJECTED phone may register again up to 3 attempts total unless the host blocked the number. On success: generate the token, store only its HMAC hash, set approval_status PENDING, store hashed IP, deviceUuid and fingerprint hash, and return { token (shown once), status: PENDING }.
- POST stations/:publicId/status: body { token }. Returns PENDING, APPROVED, REJECTED (with the rejection reason) or REVOKED. Rate limited because the front end polls it every 30 seconds.

Host endpoints under /api/v1/host/stations/:id/voters:
- GET list with search by name or phone, filter by status, pagination, and counts (Pending, Approved, Rejected, Voted, Revoked, and the cap). Each row includes the display phone, the whatsappUrl and a device flag computed from other registrations that share the same client_device_uuid or fingerprint hash ("SAME_DEVICE_AS_N", a hint only). Never include token data.
- POST :voterId/approve, POST :voterId/reject { reason? }, POST bulk-approve { voterIds | allPending: true } and bulk-reject. Approvals and rejections are allowed in REG_OPEN and REG_CLOSED and locked from VOTE_OPEN.
- POST :voterId/revoke (approved voters who have not voted, until VOTE_CLOSED), POST :voterId/reissue-token (returns the new token once; the old hash is overwritten so the old token stops working immediately; resets failed_attempts and locked_until), POST :voterId/block-number.
- GET integrity: approved voters, ballots cast, abstentions, and an alert flag when ballots exceed approved voters.
- GET export.csv: names, phone numbers and statuses only. Never include votes.

Rules: every host action writes to activity_log. When rejecting frees a slot while registration is open, registration accepts new voters again. Registration closes only at reg_ends_at through the scheduler (M10), not because the cap is reached. The device and fingerprint data never block a Closed Vote registration.

Tests: cap counting with pending plus approved, concurrent registrations at the cap boundary, duplicate phone handling, 3-attempt rule, block, reissue invalidating the old token, approval locks after voting opens, CSV never contains tokens.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M7-registration-approval.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M8. Voting API (Closed Vote and Public Poll)

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement ballot access and submission. Read spec sections 4.3, 4.6, 4.7, 4.9 and 5.1. This is the most security-sensitive module: be strict.

Closed Vote, under /api/v1/public/stations/:publicId:
- POST vote/enter: body { token, phone? }. Normalize the token with normalizeTokenInput and compute its HMAC. Look the voter up by (station, token_hash); when a phone is supplied, look up by phone and compare hashes in constant time. The station must be VOTE_OPEN. The voter must be APPROVED, not revoked, not blocked, not locked and not already voted. Lockout: 5 wrong attempts on a phone cause a 15 minute lock, 10 flag the voter for the host (set flag_reason). Wrong token attempts without a phone count against a loose per-IP limit instead. On success return a signed ballot session (HMAC with SESSION_SECRET, scoped to the station and voter, expiring at the voting window end, or 2 hours, whichever is sooner) and the ballot (categories and candidates). If the voter already voted, return errors.vote.alreadyVoted and, when results_visibility is IMMEDIATE, also a results access token.
- POST vote/submit: requires the ballot session. Body { selections: [{ categoryId, candidateId | "ABSTAIN" }] }. Validate that every category appears exactly once, each candidate belongs to its category, and ABSTAIN is allowed only when allow_abstain is true. Then, in ONE transaction: lock the voter row (SELECT FOR UPDATE), confirm approved and not has_voted, insert one cast_votes row per category using a random UUID (candidate_id null for Abstain, no voter reference, no timestamp), set has_voted = true and voted_at truncated to the minute. A second submit must fail with errors.vote.alreadyVoted. Return a confirmation without echoing the choices, plus a results access token when results_visibility is IMMEDIATE.

Public Poll:
- POST vote/submit with { selections, deviceUuid, fingerprintHash } and no ballot session. Station must be PUBLIC_POLL and VOTE_OPEN. In one transaction: reject when a device_records row for this station and deviceUuid already has_voted; reject with errors.vote.capacityReached when the station's ballots reached the ceiling (default 2500, from configuration); insert the device record, then the cast_votes rows, with no link between them. A fingerprint-only match with a different deviceUuid is accepted but counted for the host (a possible-duplicates counter, not a block).

Results:
- GET results: CONCEALED stations return results to anyone with the link only after VOTE_CLOSED. IMMEDIATE stations return them only with a valid results access token, until close and afterwards.

Rules and tests:
- Responses must never reveal which candidate a voter picked or link a voter to a vote.
- Never read cast_votes in insertion order; sort by candidate or shuffle.
- Tests: full happy path, wrong token lockouts and unlock timing, revoked or unapproved voters, double submit race with 20 parallel requests (exactly one succeeds), partial ballots rejected, abstain rules, Public Poll duplicate device, ceiling reached, concealed versus immediate results access, and a test that no response or log line contains a token.

First reply with a short plan and the list of files you will create or change. Wait for my approval before editing anything.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M8-voting-api.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M9. Analytics and exports

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement the host analytics API. Read spec sections 7.5 and 4.9.

Endpoints under /api/v1/host/stations/:id/analytics:
- GET snapshot: returns turnout (ballots submitted divided by approved voters; for Public Poll a plain ballots-cast counter plus the possible-duplicates counter), ballots cast versus approved count, time remaining, per-category leaderboards (candidate, count, percentage, isLeader, isTie when two or more candidates share the top count), abstentions, status, and lastUpdated. Before VOTE_OPEN return a waiting state; after VOTE_CLOSED mark results final.
- GET audit: timestamped check-in activity read ONLY from registered_voters (has_voted and voted_at). It must never read cast_votes and must contain no candidate information.
- GET export.csv: summary results per category and candidate.
- GET stream (optional, second step): server-sent events or a WebSocket endpoint that pushes the snapshot every 3 to 5 seconds. Build the polling snapshot first. If you add the stream, put it behind an interface so Durable Objects can implement it on Workers, and document the free-tier limits in backend/docs/runtime-spike.md.

Keep queries cheap (aggregate in SQL, add indexes if needed). Cache the snapshot per station for 2 seconds so many dashboards do not multiply database load.

Tests: tie detection, turnout math, audit endpoint leaks nothing about candidates, ownership checks.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M9-analytics.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M10. Scheduler and data lifecycle jobs

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: implement scheduled jobs. Read spec sections 4.8, 6.1, 12.3. Write them as plain idempotent functions in modules/jobs that can run from a Cloudflare Cron Trigger (the Workers `scheduled` handler) and from a local script `pnpm --filter backend jobs:run`.

Jobs:
1. stationTick (every minute): REG_OPEN -> REG_CLOSED when reg_ends_at has passed; open voting when vote_starts_at has arrived (Closed Vote from REG_CLOSED, Public Poll from DRAFT with is_launched); VOTE_OPEN -> VOTE_CLOSED when vote_ends_at has passed (set closed_at).
2. retentionPurge (hourly): for TEMPORARY and PAY_PER_USE hosts, 7 days after closed_at (configurable) delete raw voter records (names, phones, token hashes, device identifiers) and device_records, keep anonymized tallies, then mark the station ARCHIVED. For TEMPORARY accounts delete the account and its data when purge_at passes. Premium stations are archived without deletion.
3. accountLifecycle (daily): email a warning to TEMPORARY hosts 48 hours before purge_at; email LONG_TERM hosts at 5 months since last_login_at; mark them for deletion at 6 months. Email goes through EmailService and only to hosts.

Rules: each job must be safe to run twice, process in small batches (Workers CPU limit), and log counts without personal data. Add the cron schedule to wrangler.toml.

Tests: time-travel tests with an injected clock for every transition and for the purge, including a check that cast_votes tallies survive the voter purge.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M10-scheduler-jobs.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M11. Security hardening and rate limiting

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: harden the API. Read spec sections 5.3, 12.2 and 12.3.

1. Production RateLimiter implementation behind the existing interface: use the Cloudflare Workers rate limiting binding if it is available on the free plan, otherwise a database-backed counter table with expiry. Apply it to login, forgot-password, registration, status checks, vote/enter, and vote/submit, with loose per-IP and strict per-phone limits as specified. The lockout columns in registered_voters stay the source of truth for token attempts.
2. Cookies: HttpOnly, Secure, SameSite=Lax, correct Domain for the app and api subdomains. CORS only for CORS_ORIGINS with credentials. Reject unknown origins.
3. Security headers, body size limits, request timeout handling, and consistent error handling that never leaks stack traces or SQL.
4. Log redaction for tokens, phone numbers, names, passwords and cookies. Add a test that scans captured logs for those values.
5. Constant-time comparison for all secrets and token hashes.
6. Neutral responses where enumeration is possible (forgot password, duplicate host email).
7. Run `pnpm audit` and report findings. Do not add new dependencies without asking.
8. Write backend/docs/security-checklist.md covering what is protected, what is a soft signal only (device fingerprint, IP), and the known limits stated in spec sections 4.1 and 5.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M11-security-hardening.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M12. Test hardening and load test plan

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Goal: make the test suite trustworthy and prepare a load test. Read spec sections 3.7 and 11.4.

1. Integration tests with supertest against vote_app_test for the full journeys: host signup -> create Closed Vote station -> launch -> voters register -> host approves -> scheduler closes registration -> start voting -> voters enter with token and vote -> analytics -> close -> results. Same for Public Poll.
2. A ballot secrecy test suite: assert there is no join path from cast_votes to registered_voters or device_records in the schema, no timestamp on cast_votes, and that vote reads are not in insertion order.
3. Concurrency tests: 50 parallel submissions for one voter, registrations racing at the cap, simultaneous approvals.
4. Coverage report; list untested branches in critical modules (auth, registration, voting).
5. Create backend/load-test/ with a k6 script and backend/docs/load-test-plan.md: scenario for 2,500 registered voters (register, check status, enter, submit), ramp profile, metrics (error rate, p95 latency, requests per day extrapolated against the Workers 100,000 per day and 1,000 per minute limits), and how to run it against a local `wrangler dev` or the staging Worker. Never run it against production. Do not execute the load test; I will.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M12-test-hardening.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M13. CI and staging deployment

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/ and .github/workflows/. The root pnpm-lock.yaml may change only as a side effect of running pnpm commands. Never touch frontend/ or any other root file. If you think another change is needed, list it under "Changes needed outside scope" in the implementation log.

Goal: continuous integration and the beta (staging) deployment. Read spec section 3.6.

1. GitHub Actions workflow ci.yml on pull requests: pnpm install --frozen-lockfile, typecheck, lint, test, with a PostgreSQL service container for TEST_DATABASE_URL.
2. Workflow deploy-beta.yml on pushes to dev: run migrations against the staging Neon database, then deploy the Worker with wrangler. It needs repository secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, STAGING_DATABASE_URL). List exactly which secrets I must create.
3. Environment configuration docs in backend/docs/DEPLOYMENT.md: ENABLE_EMAIL_VERIFICATION=false for the beta tier, DB_DRIVER=neon, CORS_ORIGINS and COOKIE_DOMAIN for the beta URLs, CLOUDINARY_UPLOAD_FOLDER (a plain setting, not a secret), and the full list of `wrangler secret put` commands for TOKEN_HMAC_SECRET, SESSION_SECRET, DATABASE_URL, the Cloudinary keys and the email provider key.
4. Add a /api/v1/health check that also verifies database connectivity (without exposing details).
5. Do not deploy anything yourself and do not edit frontend files. Tell me the manual steps in order.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M13-ci-staging-deploy.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

### M14 (deferred, do not run during the beta). Payments and email verification

```text
SCOPE RULE (strict): Create or edit files ONLY inside backend/. Never create, edit, rename or delete anything outside backend/ (no root files, no frontend/, no packages/, no .github/). The single exception is the root pnpm-lock.yaml, which may change only as a side effect of running pnpm commands and must never be edited by hand. If you think a change outside backend/ is needed, do not make it: write it under the heading "Changes needed outside backend" in the implementation log and continue without it.

Only run this after funding. Read spec sections 6.3, 8 and 12.1.
Implement the PayChangu integration: hosted checkout initialization, server-side verification with GET /verify-payment/{tx_ref}, a webhook endpoint that verifies the HMAC-SHA256 signature over the raw body with a constant-time comparison and returns 200 OK, idempotent fulfillment (the four checks: matching tx_ref record, status success or successful, expected currency, amount at least the fee), the payments table updates, and the payment gate in the station launch flow behind a feature flag. Also enable the production email verification path (ENABLE_EMAIL_VERIFICATION=true) with a real email provider and tests for both flag values.

Closing instructions: run `pnpm typecheck`, `pnpm lint` and `pnpm test` and fix failures you caused. Update backend/docs/api.md with any new or changed endpoints (method, path, auth, request, response, error keys). Write an implementation log to backend/docs/implementation-log/M14-payments-email-verification.md with: date, goal, files created or changed, decisions and any deviations from the spec or this prompt, commands run, test results, manual steps for me, and open questions. Before finishing, run `git status --short` and confirm every changed path is inside the allowed scope from the SCOPE RULE above; list any path that is not, and do not touch it further. Finish with: (1) a summary of what you changed, (2) anything I must do manually, (3) anything in the spec you found ambiguous or contradictory.
```

---

## Part 4. Manual checkpoints (what you do between prompts)

| After | You do |
| --- | --- |
| Part 1 | Repo cloned, `voting-app-v1` tag pushed, `dev` branch pushed, spec saved at `backend/docs/project-specification.md`, local databases created, `.env.local` and `.dev.vars` written, Copilot instructions file added. |
| Every module | Read its implementation log in `backend/docs/implementation-log/` and check the decisions and deviations it lists before merging. |
| M0 | Read `backend/docs/legacy-audit.md` and answer the questions. Decide what happens to legacy code. |
| M1 | Run `pnpm install`, start the backend and frontend with pnpm, and confirm `npm install` is refused. Read the M1 implementation log for dependency version drift. In the Vercel dashboard, clear any install or build command override that mentions npm on the new platform project (leave the live project alone until `dev` is merged). Check that the first Vercel build log says it used pnpm. |
| M2 | Run both `dev` and `dev:worker`. Read `backend/docs/runtime-spike.md`. This decides whether Express stays or Hono is used. |
| M3 | Run `pnpm --filter backend db:migrate` and `db:seed`. Open the tables with `psql` and look at them. |
| M5 | Check the measured password hash time. If it is too slow for 10 ms, raise the topic (paid plan or lower iterations) before continuing. |
| M6 to M8 | Test the endpoints with an API client (curl, Bruno or Postman) using the seeded data. |
| M11 | Review `backend/docs/security-checklist.md` yourself. |
| M12 | Run the load test yourself against local or staging, then decide the free-tier voter recommendation. |
| M13 | Create the Neon staging project, add the GitHub secrets, run `pnpm wrangler login`, set the Worker secrets, and merge to `dev` to trigger the first deployment. Then create the Vercel project for the front end (root directory `frontend`). |

## Part 5. Decisions and open items to keep an eye on

- **Express on Workers:** decided by the M2 spike. The layered design means only the controller layer changes if Hono is needed.
- **Host password hashing on Workers:** decided by the M5 benchmark.
- **Mobile number rule:** the 9-digit, starts-with-8-or-9 rule in M4 is an assumption. Check it against the official numbering plan.
- **Free-tier voter limit:** the 2,500 recommendation is confirmed or changed by the M12 load test.
- **Email provider:** the Console provider works for development. Password reset in the beta needs a real provider, so set up a free provider and a sender domain before inviting beta hosts.
- **Front end:** the front-end prompt pack follows once the Stitch designs are ready. It will use the endpoints documented in `backend/docs/api.md`.
