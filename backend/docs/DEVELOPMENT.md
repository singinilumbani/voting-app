# Backend development

Run all commands from the backend workspace root. The backend targets Node.js 22 LTS and pnpm 12 or newer.

## Install

Use Node.js 22 (`.nvmrc`) and pnpm 12.4.1 or newer, then install the locked dependencies:

```sh
pnpm install --frozen-lockfile
```

The preinstall guard rejects installs initiated by other package managers.

## Run

Start the existing Express application with automatic restart:

```sh
pnpm dev
```

The server listens on port 5000 by default. Its database and service integrations require the environment variables used by the existing application; do not commit secrets.

`pnpm dev:worker` is wired to Wrangler and `wrangler.jsonc`, but the Worker entrypoint (`src/worker.ts`) is intentionally deferred to the runtime spike. The existing Node Express server is not a Worker fetch handler, so this command is not a runnable backend Worker yet.

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
