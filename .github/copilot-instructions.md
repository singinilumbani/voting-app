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
- Never edit files under frontend/ unless the prompt says so.
- All documentation lives in backend/docs/. Never create documentation files anywhere else. After finishing every module, write an implementation log to backend/docs/implementation-log/M<number>-<short-name>.md.
