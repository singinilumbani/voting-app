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

The demo host email defaults to `demo-host@example.test`; override it with `DEMO_HOST_EMAIL`. Its `password_hash` is a syntactically valid `pbkdf2-sha256$iterations$salt$hash` placeholder, not a credential; M5 replaces it with a real PBKDF2 hash. Voter-token, IP and fingerprint hashes are lowercase hexadecimal HMAC-SHA-256 values; session and password-reset token hashes are lowercase hexadecimal SHA-256 values. `pnpm db:reset` recreates the schema and reapplies migrations only when `APP_ENV=development` targets `vote_app_dev`, or `APP_ENV=test` targets `vote_app_test`. The integration test helper independently verifies that the configured test URL names `vote_app_test`, applies migrations and truncates its tables.

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
