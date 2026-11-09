# F1 — Design system

## Date

2026-11-09

## Goal

Implement the shared Material Design 3-inspired frontend design system from
specification sections 3.2 and 3.4: theme tokens, Commissioner typography,
reusable UI primitives, development showcase, and token/accessibility checks.

## Files created or changed

- `src/styles/globals.css` — Tailwind v4 color, surface, shape, elevation,
  state-layer, motion, and type-scale tokens; shared component styles and
  responsive/reduced-motion behavior.
- `src/app/layout.tsx` — variable Commissioner font with Latin subset, swap
  display, and the `--font-commissioner` variable; imports the shared stylesheet.
- `src/app/globals.css` — removed the scaffold stylesheet.
- `src/components/ui/Icon.tsx` — Material Symbols icon component.
- `src/components/ui/primitives.tsx` — button, text/password/number/date-time
  fields, select, toggle, checkbox, card, banner, status badge, chip, skeleton,
  empty state, progress bar, tabs, page header, auth card, and copy-link field.
- `src/components/ui/dialogs.tsx` — focus-managed modal and dialog variants,
  bottom sheet, snackbar, snackbar provider, and hook.
- `src/components/ui/ComponentShowcase.tsx` — interactive examples of
  components, variants, and states.
- `src/components/ui/components.test.tsx` — component interaction, variant,
  disabled/error, keyboard/focus, clipboard, axe, and color contrast tests.
- `src/app/dev/components/page.tsx` — development component sheet route, hidden
  with a 404 when `NEXT_PUBLIC_ENV` is `production`.
- `src/locales/en.json` — development showcase text.
- `src/styles/globals.css` is the only source file permitted to define literal
  hex color values.
- `scripts/check-tokens.mjs` — rejects raw 3/6-digit hex colors and arbitrary
  color utility classes elsewhere under `src/`.
- `package.json` and `pnpm-lock.yaml` — added `@material-symbols/font-400` and
  `vitest-axe`; extended formatting to include implementation logs.
- `vitest.setup.ts` — axe setup and explicit Testing Library cleanup.
- `docs/screens.md` — added `/dev/components`.
- `docs/implementation-log/README.md` — linked this entry.

## Decisions and deviations

- The Commissioner font uses Next's `weight: "variable"` option, Latin subset,
  `display: "swap"`, and the CSS variable requested.
- Pacific Cyan controls use Carbon Black foregrounds. A test reads the theme
  tokens and verifies a WCAG contrast ratio of at least 4.5:1.
- Modal focus is initially moved into the dialog; Tab and Shift+Tab are trapped,
  Escape calls the close handler, and focus is restored after close.
- Text and accessible names are supplied through props. Showcase copy and sample
  labels come from `src/locales/en.json`.
- Axe's color-contrast rule is disabled in the jsdom axe run because jsdom does
  not implement canvas-based contrast evaluation. A separate token-driven
  contrast test verifies Carbon Black on Pacific Cyan.
- `NEXT_PUBLIC_ENV` controls the development-only route. Since Next.js embeds
  public environment variables at build time, set it to `production` for a
  production build to omit the showcase.
- Changes needed outside frontend: none.

## Commands run

- `pnpm add @material-symbols/font-400`
- `pnpm add -D vitest-axe`
- `pnpm format`
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:tokens`
- `pnpm build`
- `NEXT_PUBLIC_ENV=production pnpm dev --port 3010`
- `curl --silent --output /dev/null --write-out '%{http_code}\n' http://localhost:3010/dev/components`

## Test results

- Frozen pnpm install: passed.
- TypeScript check: passed.
- ESLint: passed.
- Vitest: 24 tests passed in 3 files before the final token contrast test was
  added; final Vitest run passed 25 tests in 3 files.
- Token check: passed.
- Production build: passed; `/`, `/_not-found`, and `/dev/components` compiled.
- Route smoke test with `NEXT_PUBLIC_ENV=production`: returned HTTP 404.

## Manual steps

- None required for F1.
- Set `NEXT_PUBLIC_ENV=production` in the build environment for production
  builds; the local development showcase remains available otherwise.

## Open questions

- Product-specific page composition and additional component families remain
  for later feature increments.
