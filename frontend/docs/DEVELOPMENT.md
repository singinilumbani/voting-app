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
this file. The API base URL to use when frontend API integration is added is:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

Replace the example URL with the local backend URL printed by its development
server. This variable is not consumed by the F0 placeholder yet.

## Running against the backend

Start the backend using its own development instructions, then set
`NEXT_PUBLIC_API_BASE_URL` in `.env.local` to its base URL and restart the
frontend. The documented health endpoint is
`/api/v1/health` (see [the API reference](./reference/api.md)). F0 does not make
API requests or configure a proxy; backend rewrites are reserved for F2.

## Project conventions

- Keep UI messages in `src/locales/en.json`.
- Put shared UI in reusable components under `src/components/`.
- Place MSW request handlers under `src/mocks/`.
- Do not commit `.env.local`, generated build output, or dependencies.
