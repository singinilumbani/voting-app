# Legacy Repository Audit

**Audit date:** 2026-10-15  
**Scope:** Read-only repository inspection against [project-specification.md](./project-specification.md). No install, build, migration, or test command was run.

## 1. Top-level structure

The repository root contains `.git/`, [backend/](../), and [frontend/](../../frontend). Both requested application folders exist. There is no root package manifest or workspace configuration.

## 2. Package manager, Node, and npm/yarn usage

### Manifests and lockfiles

| Path | Package / language | Package manager and runtime metadata | Scripts |
|---|---|---|---|
| `backend/package.json` | `backend`; JavaScript, CommonJS (`"type": "commonjs"`); source is `.js` | No `packageManager` or `engines` field | `dev`: `nodemon index.js`; `test`: placeholder that prints an error and exits 1 |
| `frontend/package.json` | `frontend`; TypeScript/TSX Next.js application | No `packageManager` or `engines` field | `dev`: `next dev`; `build`: `next build`; `start`: `next start`; `lint`: `eslint` |

Exactly two package manifests were found; there is no root `package.json` and no other package in the repository. The manifests do not pin a Node or package-manager version. There is no `.nvmrc` or `.npmrc`.

| Lockfile | Location |
|---|---|
| `package-lock.json` | `backend/package-lock.json` (lockfile version 3) |
| `package-lock.json` | `frontend/package-lock.json` (lockfile version 3) |
| `npm-shrinkwrap.json` | None found |
| `yarn.lock` | None found |
| `pnpm-lock.yaml` | None found |

The existing npm lockfiles indicate npm was used to resolve/install dependencies, but neither manifest declares `packageManager`. No `legacy-peer-deps`, dependency override, or equivalent peer-resolution setting was found.

### Dependency declarations and imports

- **Backend dependencies:** `bcrypt`, `cloudinary`, `cookie-parser`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `jsonwebtoken`, `multer`, `multer-storage-cloudinary`, and `pg`; dev dependency `nodemon`.
- **Frontend dependencies:** `next` 16.3.5, `react` 19.2.8, `react-dom` 19.2.8; dev dependencies `@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom`, `babel-plugin-react-compiler`, `eslint`, `eslint-config-next`, `tailwindcss`, and `typescript`.
- The frontend TypeScript compiler configuration enables `strict`; it does not set `noUncheckedIndexedAccess`.
- Comparing the source imports with the declared packages found **no apparent undeclared third-party (phantom) dependency**. Node built-ins such as `crypto` are not package dependencies. `express-rate-limit` is declared in the backend but no use was found in the source.
- Versions above are manifest declarations, not a vulnerability verdict. No dependency-advisory scan was run; the lockfiles themselves do not establish whether a resolved package is currently vulnerable or outdated.

### Complete npm / npx / yarn usage inventory

No application package script executes `npm`, `npx`, or `yarn`.

| Location | Finding |
|---|---|
| `frontend/README.md` lines 8-10 | Shows `npm run dev` and `yarn dev` as alternatives to start the app. |
| `backend/docs/build-prompts/copilot_backend_build_prompts.md` | Contains the planned pnpm migration instructions and literal npm/yarn command examples, including install, run, ci, test, and npx/dlx equivalents. These are documentation prompts, not executable scripts. |
| `frontend/.gitignore` | Contains `.yarn/`, `npm-debug.log*`, and yarn debug-log ignore patterns; these are ignore rules, not commands. |
| `backend/package-lock.json`, `frontend/package-lock.json` | npm lockfiles; their resolved tarball URLs use `registry.npmjs.org`. These are dependency metadata, not commands. |

No shell scripts, Makefiles, Dockerfiles, Git hooks, GitHub Actions workflows, Vercel configuration files, or other CI/deploy configuration files were found. In particular, no `npx` command was found outside the documentation migration prompt. The documentation prompt itself requests a later whole-repository search and migration; this audit does not perform that migration.

## 3. Backend

- **Framework/runtime:** Node.js with Express 5 (`express` declared as `^5.2.1`), CommonJS JavaScript. Entry point is [index.js](../index.js); the package `dev` script starts it through nodemon.
- **Middleware:** Helmet, CORS with credentials, JSON parsing, cookie parsing, and dotenv initialization. `FRONTEND_URL` controls the one allowed CORS origin, defaulting to `http://localhost:3000`.
- **Routes:**
  - `GET /` — API health message.
  - `GET /api/positions` — returns positions with their candidates.
  - `POST /api/auth/login` — administrator login.
  - `GET /api/vote/status` and `POST /api/vote` — browser voter-token status and vote submission.
  - Under `/api/admin` (all protected by bearer JWT middleware): `POST /positions`, `PUT /positions/:id`, `DELETE /positions/:id`, `POST /candidates`, `DELETE /candidates/:id`, and `GET /results`.
- **Authentication:** administrator email/password is checked using bcrypt; the backend issues a two-hour JWT. Admin endpoints require a bearer token. The frontend stores it in `localStorage`. Voting identity is a random UUID stored in an HTTP-only `voter_token` cookie, with production `SameSite=None` and `Secure`; it is not a registered-voter approval/token system.
- **Database/query layer:** PostgreSQL via `pg`'s `Pool`, using handwritten parameterized SQL. No ORM or migration framework was found. The schema is in [schema.sql](../src/sql/schema.sql) and creates the `pgcrypto` extension.
- **Current tables and columns:**
  - `admins`: `id UUID` primary key/default `gen_random_uuid()`, `email TEXT UNIQUE NOT NULL`, `password TEXT NOT NULL`, `created_at TIMESTAMP DEFAULT now()`.
  - `positions`: `id UUID` primary key/default UUID, `title TEXT NOT NULL`, `created_at TIMESTAMP DEFAULT now()`.
  - `candidates`: `id UUID` primary key/default UUID, `name TEXT NOT NULL`, `photo_url TEXT NOT NULL`, nullable `bio TEXT`, and required `position_id UUID` referencing `positions(id) ON DELETE CASCADE`.
  - `votes`: `id UUID` primary key/default UUID, required `voter_token TEXT`, required `position_id UUID` referencing positions with cascade, required `candidate_id UUID` referencing candidates with cascade, `created_at TIMESTAMP DEFAULT now()`, and `UNIQUE (voter_token, position_id)`.
- **Media:** candidate image uploads go through multer and `multer-storage-cloudinary`; image type/size limits are set in middleware. Cloudinary folder is hard-coded as `voting-app-candidates`.
- **Environment variables read in runtime source:** `DATABASE_URL`, `FRONTEND_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- **Local ignored environment file:** `backend/.env.local` exists, is ignored by `backend/.gitignore`, and is not tracked. Its variable names include `APP_ENV`, `DB_DRIVER`, `DATABASE_URL`, `TEST_DATABASE_URL`, `TOKEN_HMAC_SECRET`, `SESSION_SECRET`, `ENABLE_EMAIL_VERIFICATION`, `FRONTEND_URL`, `CORS_ORIGINS`, `COOKIE_DOMAIN`, `PASSWORD_HASH_ITERATIONS`, Cloudinary settings, and email-provider settings. Values are intentionally not reproduced here. The backend calls `dotenv.config()` without a custom path, which loads `.env` by default, not `.env.local`; the ignored file therefore is not loaded by this code as-is unless the process environment or external launcher supplies those values.
- **Scripts:** `dev` only; `test` is an explicit failing placeholder. [createAdmin.js](../src/scripts/createAdmin.js) is a standalone CLI utility but is not exposed as a package script.

## 4. Frontend

- **Framework/version:** Next.js 16.3.5, React 19.2.8, TypeScript, App Router under `frontend/src/app/`.
- **Pages:** `/` voting page, `/admin/login`, `/admin/dashboard`, and `/voted`. The root layout supplies the NACSO header and Roboto font.
- **Styling:** Tailwind CSS v4 utility classes and `globals.css`; styling is largely page/component-local, with hard-coded color values. No Material Design 3 component system or translation dictionary was found.
- **State:** React local component state and effects; no app-wide state-management library. Admin JWT is persisted in `localStorage`. The voter token is managed by the server cookie. No persistent setup-wizard draft state exists.
- **API calls:** `frontend/src/lib/api.ts` uses `NEXT_PUBLIC_API_URL` as the backend base URL. It calls the positions endpoint, vote/status endpoints with `credentials: 'include'`, login, and authenticated admin CRUD/results endpoints with bearer JWT. No default API origin is defined there.
- **Environment variable found in frontend source:** `NEXT_PUBLIC_API_URL`.
- The frontend package has dev/build/start/lint scripts but no test or typecheck script.

## 5. Deployment, CI, and hard-coded URLs

- The only deploy-related repository material is the generic Next.js/Vercel guidance in `frontend/README.md`. No repository setting proves that production deploys from `main`; no GitHub Actions, Vercel project config, Dockerfile, or deployment script is present. Vercel project linkage, root directory, deployment branch, build/install overrides, and environment values must be checked in the Vercel dashboard.
- Backend source hard-codes `http://localhost:3000` as the fallback CORS origin. Frontend API origin is environment-configured. The backend Cloudinary folder is hard-coded as `voting-app-candidates`.
- Other localhost/API URLs found are in setup/specification documentation, not runtime app URLs.

## 6. Tests and validation state

- No test files, test framework, or frontend test script were found.
- The backend `test` script is a placeholder that exits unsuccessfully; it is not a test suite.
- No tests, build, install, migration, or dependency audit were run for this audit, per scope constraints.

## 7. Risks and specification conflicts

1. **Ballot secrecy conflict (core data-model issue):** each vote row stores `voter_token`, `position_id`, `candidate_id`, and a timestamp. The voter token is also returned in vote status, so the database directly links voter identity to ballot choice. This conflicts with specification sections 4.9 and 9, which require `CastVotes` to have no voter/device foreign link and no per-vote timestamp.
2. **No tenant boundary:** all current administrators, positions, candidates, and votes are global. There is no host/account ownership column or polling-station scope. Admin authorization proves only possession of a JWT; there is no tenant-scoped authorization.
3. **Wrong lifecycle and voting identity:** the app has no Public Poll/Closed Vote modes, registration and host approval queue, voter token issuance/HMAC storage/expiry/reissue, station lifecycle/windows, voter cap, or station-scoped anti-fraud signals. Current one-vote-per-position behavior is browser-cookie based and is not an identity or authorization model from the specification.
4. **Results and rules:** admin results aggregate live vote counts without a station lifecycle or concealed-results setting. There is no public poll/device policy, abstention, station-level candidate-edit lock, audit log, or event lifecycle.
5. **Authentication/security gaps relative to target:** the current single admin login is not host signup/account management; no password reset/profile/email-verification lifecycle exists. JWTs are stored in browser `localStorage`. `express-rate-limit` is installed but not wired into routes. No explicit rate limits for login, voter status, or vote submission were found.
6. **Runtime portability:** the specification targets Cloudflare Workers and mentions testing Express compatibility. Current backend uses Node `pg` and native `bcrypt`; compatibility with the target runtime is unverified and these are potential migration/runtime blockers. No Cloudflare Worker config or adapters were found.
7. **Environment configuration mismatch:** code expects `JWT_SECRET`, while it was not among the names in the inspected `.env.local`; the current dotenv calls also do not load that filename by default. The spec's `DB_DRIVER`, `TEST_DATABASE_URL`, `TOKEN_HMAC_SECRET`, and related settings are present in the ignored local file but are not used by current source.
8. **Data migration/destructive cascade risk:** deleting a position cascades to candidates and votes; deleting a candidate cascades to votes. A migration plan must decide whether old poll data is retained, exported, assigned to an initial tenant, or intentionally discarded.
9. **Credentials:** no environment file was tracked, and the local `backend/.env.local` is ignored. No obvious committed credential was identified during source/config review. This is not a full secret-scanner or history scan; the local ignored file may contain secrets and should remain unshared.
10. **Dependency status is unverified:** exact installed versions were not adjudicated against current security advisories or latest releases. The manifests provide no supported Node version; the frontend has `@types/node` major 20 while the specification asks for Node 22. A package advisory scan and runtime compatibility check remain necessary before deployment.

## 8. Existing-feature mapping to the specification

| Existing feature | Closest specification feature | Recommendation |
|---|---|---|
| NACSO-branded app shell, header, logo and basic Tailwind styling | Shared AppShell, reusable M3 components, design tokens, localization (3.2–3.5) | **Refactor** — reuse brand assets where appropriate, rebuild the shell/theme and externalize UI strings. |
| Public home page showing positions and candidates | Public Poll and Closed Vote ballot/entry flows; station/category views (4.1, 4.6–4.7) | **Refactor** — the current page has no station context or mode and should become the appropriate flow-specific ballot experience. |
| Position CRUD | Polling-station setup wizard's Categories/Positions step and station detail management (7.3, 7.6) | **Refactor** — retain the concept, scope to a station, make reorder/edit/lifecycle rules explicit. |
| Candidate create/delete, name, bio, photo | Nominees/Candidates wizard and station Candidates tab (7.3, 7.6) | **Refactor** — preserve candidate concepts/media, add tenant/station/category scoping, editing/locking rules, and required upload UX. |
| Server-mediated Cloudinary image upload | Direct browser-signed Cloudinary uploads (3.1, 3.3, 7.3) | **Refactor** — provider can be reused; replace upload mechanism/folder/config as specified. |
| Admin email/password login, bcrypt hash, bearer JWT | Host onboarding/authentication and profile lifecycle (6) | **Refactor** — bcrypt hashing is reusable in a compatible runtime, but global admin auth and token handling must become tenant-aware host auth. |
| Admin dashboard CRUD and logout | Host Dashboard, setup wizard, station detail, voter queue and settings (7) | **Refactor** — keep useful interaction concepts only; replace the global administrator dashboard. |
| Vote-per-position UI and backend duplicate constraint | Single ballot per voter/station and candidate/category ballot (4.7, 4.9) | **Refactor** — enforce the specified station-scoped rules through registration/token and transaction logic. |
| Browser voter UUID cookie and vote-status endpoint | Closed Vote token/status/reminder flow; Public Poll device identifier (4.3, 4.6, 5.1) | **Remove later** — this cookie is not the approved Closed Vote credential or the specified station-scoped device model; replace it rather than migrate it as an identity. |
| `votes` table retaining voter token and timestamp | Unlinked `CastVotes` and separate voter/device check-in records (4.9, 9) | **Remove later** — replace the schema and write path; do not carry over the voter-to-choice relation. Decide separately what legacy ballot data can legally/operationally be retained. |
| Live admin result aggregation | Host live analytics and results visibility modes (7.5, 7.6; 11.1) | **Refactor** — retain aggregation concept but scope it to tenant/station and honor concealment, lifecycle, and privacy. |
| PostgreSQL through `pg` and handwritten SQL | Local PostgreSQL and Neon PostgreSQL; Prisma or Drizzle (3.1, 3.3) | **Refactor** — database engine aligns, but add scoped schema, transaction-safe repositories, and the chosen ORM/query strategy. |
| Standalone administrator-creation script | Host signup/account onboarding (6.1–6.2) | **Remove later** — replace the one-off global-admin bootstrap with the selected host account provisioning flow. |

### Major specification capabilities not present in the legacy app

No implementation was found for multi-tenancy/host accounts, public vs. closed modes, registration and approval, Malawi phone normalization, token HMAC/reissue/lockout, station lifecycle and scheduling, device flags/mobile gate, unlinked ballot transactions, draft persistence, M3 reusable components/locales, real-time analytics/audit logs, export/retention, host email flows, payment integration, or scheduled cleanup. PayChangu and email are explicitly post-beta in the specification.

## 9. Questions to answer before restructuring

1. **Legacy data:** Should existing administrators, positions, candidates, and votes be migrated into a first tenant, exported/read-only, or discarded? If migrated, which organization owns them?
2. **Tenancy and host accounts:** Is the specification's one host account owning isolated polling stations the intended tenant boundary, and what should happen to the existing admin login/account?
3. **Beta modes:** Should both Public Poll and Closed Vote ship in the first beta as specified, or should one mode be staged for a later release?
4. **Ballot secrecy:** Confirm that the new database must never persist a voter/device-to-choice link or per-vote timestamp, even though this means legacy vote history cannot be migrated as currently represented.
5. **Malawi phone validation:** Confirm the proposed +265 normalization rule (9 national digits beginning with 8 or 9), including how international numbers and spreadsheet-damaged input should be handled.
6. **Device/privacy signals:** Approve the specification's device UUID, fingerprint hash, IP hash, and host-visible duplicate flags, including the proposed disclosure and retention/purge policy under Malawi's Data Protection Act 2024?
7. **Backend runtime:** Is Cloudflare Workers the required beta backend, or may implementation begin on a Node.js host if Express/`pg`/password hashing compatibility proves unsuitable?
8. **Hosting and environments:** Which Vercel project, production branch, API host, and database are the beta targets? Should `main` or another branch deploy automatically, and should the existing project remain untouched until a feature branch merges?
9. **Capacity and limits:** Accept the 50,000 design ceiling and 2,500 recommended Public Poll/free-tier ceiling pending load tests, or choose different launch caps?
10. **Host auth and email:** Keep email verification and PayChangu deferred for beta as specified? Which email provider and Workers-compatible host-password hashing approach should be used when those flows are enabled?
