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
