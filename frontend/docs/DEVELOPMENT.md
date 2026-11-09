# Frontend development

## Requirements

- Node.js 22 or newer (`.nvmrc` selects 22).
- pnpm 12.4.1, matching the `packageManager` field in `package.json`.

## Install and run

From the frontend workspace root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js. The home route is currently a blank
placeholder.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test:watch` runs Vitest interactively. `pnpm format` formats application,
tooling, and the active frontend documentation files.

## Environment

Create `.env.local` in the frontend root for local-only values. Do not commit
this file. Select one API mode:

```dotenv
# Same-origin requests through the Next.js rewrite
NEXT_PUBLIC_API_MODE=proxy
API_PROXY_TARGET=http://localhost:8787

# Or call the API origin directly from the browser
# NEXT_PUBLIC_API_MODE=direct
# NEXT_PUBLIC_API_URL=http://localhost:8787

# Set true to use the built-in MSW browser handlers during development
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_ENV=development
```

Replace the example host/port with the local API URL printed by the backend
development server. `API_PROXY_TARGET` is server-only and is used only in proxy
mode. Next.js rewrites `/api/v1/*` to that target; rewritten responses,
including `Set-Cookie`, are returned through the same-origin response.
`NEXT_PUBLIC_API_URL` is required in direct mode and must be an origin accepted
by the backend's credentialed CORS allowlist.

## API mocks

Set `NEXT_PUBLIC_ENABLE_MOCKS=true` in `.env.local` and restart `pnpm dev` to
start the MSW browser worker. The worker serves host auth and public station
configuration examples without requiring the backend. Set it to `false` (or
remove it) to use the configured proxy/direct API. Unhandled requests bypass
MSW, allowing both mocked and real requests to coexist. Vitest uses the same
handlers through the Node MSW server.

## Running against the backend

Start the backend using its own development instructions, then set
Set `API_PROXY_TARGET` when using proxy mode, or set `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_API_MODE=direct` for direct mode, then restart the frontend. The
documented health endpoint is `/api/v1/health` (see
[the API reference](./reference/api.md)).

Server components can use `serverApiFetch` from `src/lib/api/server.ts`; it
forwards the incoming request's `Cookie` header. The API proxy target is read
only by the Next.js server configuration and is not exposed as a public
environment variable.

## Project conventions

- Keep UI messages in `src/locales/en.json`.
- Put shared UI in reusable components under `src/components/`.
- Place MSW request handlers under `src/mocks/`.
- Do not commit `.env.local`, generated build output, or dependencies.
