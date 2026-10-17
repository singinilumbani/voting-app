# M2 Backend Skeleton and Runtime Spike

- **Date:** 2026-10-15
- **Goal:** Add a strict TypeScript Express backend skeleton that runs locally on Node and Cloudflare Workers, and prove the shared health endpoint in both.

## Files created or changed

- `package.json`, `pnpm-lock.yaml`: added Zod `4.6.7`, `tsx` `4.23.15`, `@types/express` `5.0.6`, `@types/cors` `2.8.19`, Supertest `7.3.1`, and `@types/supertest` `7.2.1`; Express and cors were already dependencies. Made `dev` run the TypeScript Node entrypoint, retained the old server as `dev:legacy`, and added Wrangler/type-generation scripts.
- `.gitignore`: ignore local `.dev.vars`.
- `wrangler.toml`, `.dev.vars.example`: set the Worker entry, current compatibility date and Node compatibility flag; document the non-secret local variables.
- `eslint.config.mjs`: exclude Wrangler-generated runtime declarations.
- `src/app.ts`, `src/server.ts`, `src/worker.ts`, `src/container.ts`: app factory, Node entry, Workers adapter, and manual dependency injection.
- `src/config/env.ts`, `src/config/env.test.ts`: Zod-validated runtime configuration and tests.
- `src/core/app-error.ts`, `src/core/error-handler.ts`, `src/core/logger.ts`, `src/core/request-id.ts`, `src/core/types.ts`: common error handling, redacted structured logging, request IDs and dependency types.
- `src/middleware/auth.ts`, `src/middleware/body-limit.ts`, `src/middleware/cors.ts`, `src/middleware/rate-limit.ts`, `src/middleware/security-headers.ts`, `src/middleware/validate.ts`: CORS, security headers, JSON body limit, Zod body validation and fail-closed placeholders for auth/rate limiting.
- `src/controllers/health.controller.ts`, `src/services/health.service.ts`: layered health endpoint implementation.
- `src/modules/auth/README.md`, `src/modules/stations/README.md`, `src/modules/registration/README.md`, `src/modules/voting/README.md`, `src/modules/analytics/README.md`, `src/modules/jobs/README.md`: reserved module boundaries.
- `src/worker-configuration.d.ts`: generated Cloudflare runtime and binding declarations.
- `src/app.test.ts`: route, error-envelope, and logger redaction tests.
- `docs/api.md`, `docs/DEVELOPMENT.md`, `docs/README.md`: document the new endpoint, runtime commands, and spike result.
- `docs/runtime-spike.md`: record runtime behavior, bundle size and limits.
- This log.

## Decisions and deviations

- Kept legacy JavaScript sources and the old `index.js` entry unchanged. `pnpm dev:legacy` starts the prior server on port 5000; the new `pnpm dev` server defaults to port 8787. The legacy and new routes do not collide because the new endpoint is under `/api/v1`; manually setting both servers to the same `PORT` would cause a port conflict.
- The Node server reads process environment only in `src/server.ts`; shared configuration parsing accepts unknown bindings and validates them identically with Zod.
- Cloudflare's current Express integration is `httpServerHandler` from `cloudflare:node`; `src/worker.ts` calls Express `app.listen(port)` and exports `httpServerHandler({ port })`. The Wrangler config explicitly enables `nodejs_compat` at compatibility date `2026-10-15`.
- Authentication and rate-limiting placeholders deny access with message keys and HTTP 503 until real implementations are injected; they do not silently pass protected traffic.
- The Workers spike succeeded for the required health route and dry-run, so no Hono migration was made. This does not prove compatibility for the legacy database/native dependencies or future modules.
- The available host runtime was Node `26.8.2`; Node `22` was not installed. The requested commands and runtime checks must be rerun with Node 22 before merge.
- Wrangler's dry-run reported no bindings. The skeleton does not configure a database or other runtime bindings.
- No live login or deployment was performed.

## Commands run

- `pnpm --dir backend add zod express cors` and `pnpm --dir backend add -D tsx @types/express @types/cors supertest @types/supertest`.
- `pnpm --dir backend install --frozen-lockfile`; passed.
- `pnpm --dir backend exec wrangler types src/worker-configuration.d.ts --config wrangler.toml`.
- `pnpm --dir backend typecheck`, `lint`, and `test`; all final runs passed.
- `pnpm --dir backend exec prettier --write ...` on supported new/changed TypeScript, JSON, and Markdown files. An initial formatting call included unsupported TOML and `.dev.vars.example` files and exited with parser errors; the corrected formatting command succeeded.
- `PORT=8788 pnpm --dir backend dev`; verified `GET /api/v1/health` returned HTTP 200, then stopped the server.
- `pnpm --dir backend dev:worker --port 8787`; verified the same health endpoint returned HTTP 200, then stopped the server. No Cloudflare login was required.
- `pnpm --dir backend dev:legacy`; verified the old `GET /` endpoint still returned its existing health response, then stopped the server.
- `pnpm --dir backend exec wrangler deploy --dry-run --config wrangler.toml`; passed and reported `1942.78 KiB / gzip: 420.96 KiB`. This was dry-run only; no deployment occurred.
- A first `tsc` run identified a type mismatch between Wrangler's `Env` and the config parser; accepting `unknown` as the parser input resolved it. A first lint run identified an unused Express error-handler parameter and lint warnings in generated types; both were resolved.

## Test results

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed; 2 test files and 5 tests.
- Node local health endpoint: passed, HTTP 200.
- Wrangler local Workers health endpoint: passed, HTTP 200.
- Legacy backend startup and health endpoint: passed.
- Wrangler deployment dry-run: passed; bundle is 1942.78 KiB uncompressed / 420.96 KiB gzip.
- Node 22 validation: not run because the host only provides Node 26.8.2.
- Final `git -C backend status --short`: all reported paths are backend-relative; no reported path starts with `../`.

## Manual steps

- Install/use Node.js 22 LTS and rerun `pnpm typecheck`, `pnpm lint`, `pnpm test`, and both local startup checks.
- For a clean clone, copy `.dev.vars.example` to `.dev.vars` before `pnpm dev:worker`; set only local non-secret values there. The existing local ignored `.env.local` was automatically discovered by Wrangler on this machine but is not part of a clean clone.
- Before database-backed modules are implemented, choose and validate the Workers-compatible Neon connection approach; benchmark CPU and request behavior within the specification's Workers limits.

## Open questions

- Node 22 LTS runtime verification remains outstanding.
- The Workers spike does not establish that native `bcrypt`, `pg`, Cloudinary upload integrations, or any other legacy dependency is compatible with Cloudflare Workers; validate each before reuse.
- No load test was run, so free-tier capacity ceilings remain unverified as stated by the specification.

## Changes needed outside backend

- None are needed to build or run this skeleton. No parent-directory, root tooling, package, or frontend file was edited for M2.
- No status path outside the backend workspace was reported, and no path starting with `../` was reported. No outside path was modified.
