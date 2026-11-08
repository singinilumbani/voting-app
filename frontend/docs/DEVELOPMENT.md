# Frontend development

## Requirements

- Node.js 22 or newer
- pnpm 12.4.1 (the version recorded in `package.json`)

## Install and run

From the frontend workspace root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The app is served at the local URL printed by Next.js.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use `pnpm test:watch` while developing tests.

## Environment and backend

No environment variables are currently consumed by the placeholder app. Keep local values in `.env.local`; `.env*` files are ignored by Git.

Backend API integration is not wired yet. When it is added, set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` to the backend's local base URL, start the backend using its own development instructions, and then run this frontend with `pnpm dev`. The current home page does not make API requests.
