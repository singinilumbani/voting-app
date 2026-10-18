# Backend development

Run all commands from the backend workspace root. The backend targets Node.js 22 LTS and pnpm 12 or newer.

## Install

Use Node.js 22 (`.nvmrc`) and pnpm 12.4.1 or newer, then install the locked dependencies:

```sh
pnpm install --frozen-lockfile
```

The preinstall guard rejects installs initiated by other package managers.

## Run

Start the new TypeScript Express skeleton on port 8787 with automatic restart:

```sh
pnpm dev
```

The existing JavaScript application remains available separately on port 5000:

```sh
pnpm dev:legacy
```

Run the same TypeScript application in Wrangler's local Workers runtime with:

```sh
cp .dev.vars.example .dev.vars
pnpm dev:worker
```

The Worker entrypoint uses Node.js HTTP compatibility through Cloudflare's `httpServerHandler`. No Cloudflare login or deployment is needed for local development. Do not commit `.dev.vars` or other secrets.

## Database

Use PostgreSQL database `vote_app_dev` locally and `vote_app_test` for integration tests. Set `DATABASE_URL` in the process environment. `DB_DRIVER=pg` uses node-postgres for local Node/test runs; Wrangler sets `DB_DRIVER=neon` and uses the Neon WebSocket Pool. Configure the Neon `DATABASE_URL` as a Worker secret. The Worker creates and closes a database pool for each request.

Generate schema migrations and apply them with:

```sh
pnpm db:generate
pnpm db:migrate
```

Seed a demo host and one station of each voting mode:

```sh
pnpm db:seed
```

The demo host email defaults to `demo-host@example.test`; override it with `DEMO_HOST_EMAIL`. Set `DEMO_HOST_PASSWORD` before running `pnpm db:seed`; the script hashes it with PBKDF2-SHA256 and does not log it. Voter-token, IP and fingerprint hashes are lowercase hexadecimal HMAC-SHA-256 values; session and password-reset token hashes are lowercase hexadecimal SHA-256 values. `pnpm db:reset` recreates the schema and reapplies migrations only when `APP_ENV=development` targets `vote_app_dev`, or `APP_ENV=test` targets `vote_app_test`. The integration test helper independently verifies that the configured test URL names `vote_app_test`, applies migrations and truncates its tables.

## Host accounts

The host API lives under `/api/v1/host/auth`. Configure `APP_BASE_URL` for verification/reset links, `COOKIE_DOMAIN` for deployments that require a cookie domain (leave it empty locally), and `PASSWORD_HASH_ITERATIONS` for the PBKDF2-SHA256 hasher (default: `5000`). Session cookies are always Secure, HttpOnly and SameSite=Lax. Email verification is disabled by default for beta; set `ENABLE_EMAIL_VERIFICATION=true` to require a single-use verification link. `EMAIL_PROVIDER=console` is the default; it logs only the template key and content with the link redacted, so no recipient, token, or credential is logged. Set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and `EMAIL_FROM` to use Brevo delivery. Email services in this module only accept host verification/reset messages; no voter email path is provided.

Benchmark the configured password hash without printing the derived hash or benchmark password:

```sh
pnpm password:benchmark
```

See [runtime-spike.md](./runtime-spike.md) for the local Node measurement and its Workers-runtime limitation.

TEMPORARY host accounts receive an initial `purge_at` seven days after signup or tier downgrade. A later election lifecycle must update that deadline to seven days after election completion, as required by the retention specification.

## Closed Vote registration

Set `TOKEN_HMAC_SECRET` to a private random value of at least 32 characters before enabling public registration. The API uses it to HMAC-scope voter tokens, hashed IP addresses, and device fingerprints; it must never be logged or committed. The public registration/status and host approval-queue routes live under `/api/v1/public/stations` and `/api/v1/host/stations/:stationId/voters`. Registration and status polling use in-memory rate limiters in this beta implementation; production needs the distributed Workers limiter planned for M11.

## Build and quality checks

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

TypeScript checking is strict, including `noUncheckedIndexedAccess`. The legacy JavaScript server is run directly by Node and is not converted by this setup. Vitest is configured for TypeScript tests; the test command succeeds when no test files have been added yet.

Format TypeScript and root tooling/configuration files with:

```sh
pnpm format
```

The format command does not reformat the existing JavaScript application.

Regenerate Cloudflare Worker runtime and binding declarations after changing `wrangler.toml`:

```sh
pnpm types:worker
```
