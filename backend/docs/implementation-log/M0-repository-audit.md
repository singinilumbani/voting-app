# M0 Repository Audit

- **Date:** 2026-10-15
- **Goal:** Inventory the legacy voting application against the multi-tenant platform specification before restructuring.
- **Scope/constraints:** Read-only inspection. Created only `backend/docs/legacy-audit.md` and this log. No install, build, migration, test, or dependency audit command was run.

## What was inspected

- Repository root structure, tracked files, package manifests and both lockfiles.
- Backend entry point, routes, auth/upload middleware, DB connection, SQL schema, admin bootstrap script, and ignore rules.
- Frontend manifest, app-router pages, components, API client, styling, TypeScript/Next/PostCSS/ESLint config, README, and ignore rules.
- Project specification and build prompts, including the specification's data model, deployment plan, voter flows, security rules, defaults, and open items.
- Search results for npm/npx/yarn, package manager configuration, URLs, package imports, deployment/CI files, and environment-file tracking. Environment variable names were inspected without printing values.

## Key findings

- `backend/` and `frontend/` exist; there is no root package manifest/workspace.
- Two npm lockfiles and two package manifests exist; no pnpm lockfile, packageManager/engines declaration, `.npmrc`, or `.nvmrc` was found.
- Backend is Express 5/CommonJS JavaScript with PostgreSQL via `pg` and handwritten SQL. Frontend is Next.js 16.3.5 App Router, React 19.2.8, and strict TypeScript.
- The existing `votes` schema records a browser voter token, candidate choice, and timestamp together. This directly conflicts with the specification's database-level ballot secrecy model.
- The current data model and admin API have no tenant or polling-station scoping. The voter cookie/login model is not the specified host-approved Closed Vote workflow.
- No test suite, CI workflow, deployment config, or test framework was found. The backend test script is a failing placeholder.
- npm/yarn appears in a frontend README command example, a backend build-prompt document, ignore patterns, and the npm lockfiles. No npm/npx/yarn command appears in package scripts.
- `backend/.env.local` exists locally but is ignored and untracked. Its values were not copied into the audit. The backend's default dotenv configuration does not select `.env.local`.
- No dependency advisory scan or hosted deployment settings could be verified under the read-only task constraints. The Vercel branch/build settings need dashboard inspection.

## Open questions

See the numbered “Questions to answer before restructuring” section in [legacy-audit.md](../legacy-audit.md). Principal blockers are the treatment of legacy vote data, confirmation of tenant/account ownership, the intended ballot-secrecy boundary, runtime/hosting choice, and approval of device/privacy and phone-number rules.

## Decisions recorded after the audit

1. Discard legacy administrators, positions, candidates, and votes; do not migrate the old application data.
2. Use one host account as the tenant boundary, with isolated polling stations; replace the global admin login with host accounts.
3. Ship both Public Poll and Closed Vote in the first beta.
4. Enforce ballot secrecy: do not persist voter/device-to-choice links or per-vote timestamps.
5. Use the specification's +265 normalization and 9-digit national number rule beginning with 8 or 9, with supported international numbers.
6. Approve the specified device UUID, fingerprint/IP hashes, duplicate flags, disclosure, and retention/purge policy, subject to applicable privacy requirements.
7. Require Cloudflare Workers; use a Workers-native fallback if Express compatibility is unsuitable.
8. Use Vercel for the frontend, Cloudflare Workers for the backend, and Neon staging DB; leave the live project untouched until merge.
9. Use the specification's 50,000 design ceiling and 2,500 recommended Public Poll/free-tier ceiling pending load tests.
10. Defer host email verification and PayChangu until after beta. Select the email provider and Workers-compatible password-hashing approach during post-beta design.
