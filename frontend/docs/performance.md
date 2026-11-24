# Performance

Date: 2026-11-24

## Analyzer

- Added `@next/bundle-analyzer`.
- Run `pnpm analyze` to build with `ANALYZE=true` and generate the Next.js bundle
- Run `pnpm analyze` to build and write the Next 16 Turbopack analysis under
  `.next/diagnostics/analyze`.
- Run `pnpm check:budgets` for the build-manifest gzip estimate.

## First-load JavaScript

The build-manifest gzip estimate is a shared-runtime-heavy Next 16 measurement,
not a route-chunk network measurement:

| Route group | Estimate | Target |
| --- | ---: | ---: |
| `/s/[publicId]/register` | 168 KB gzipped | about 130 KB |
| `/s/[publicId]/ballot` | 168 KB gzipped | about 130 KB |
| `/host` | 168 KB gzipped | about 220 KB |
| `/host/stations/[id]/[tab]` | 168 KB gzipped | about 220 KB |

Host routes pass the 220 KB target in the estimate. Voter routes remain 38 KB
above the target because the estimate includes Turbopack's shared runtime. The
budget test records positive route measurements but is intentionally not a
blocking assertion: Next 16 build manifests do not reliably isolate compressed
per-route first-load JavaScript.

The production server's Lighthouse script-transfer totals were:

| Route | Script transfer |
| --- | ---: |
| `/` | 217 KB |
| `/s/mock/register` | 242 KB |
| `/s/mock/ballot` | 249 KB |

## Lazy loading

- ThumbmarkJS is dynamically imported only by voter registration/ballot hooks.
- QR code rendering is dynamically imported for mobile gate and host share UI.
- TanStack Query and mock initialization are hosted in `/host` and the landing
  auth route, not the public `/s/` layout.
- Global offline/session UI is behind a client-only dynamic wrapper.

## Images

- Candidate images use `next/image`.
- Cloudinary URLs receive `f_auto,q_auto,w_<width>` transformations.
- Voter cards use `fill`, a 4:3 fixed aspect ratio, and `sizes` for phone/desktop.
- Lazy loading remains enabled by `next/image` for below-the-fold images.

## Fonts

- Commissioner is loaded once in the root layout.
- The subset is `latin`.
- `display: "swap"` is configured.
- The built HTML preloads the generated Commissioner WOFF2.

## Server cache and polling

- Public station config fetch uses `next: { revalidate: 30 }`.
- Analytics polling starts at 4 seconds and backs off to 30 seconds after
  failures.
- Registration status polling is 30 seconds while the tab is visible.

## Request budget

The spec's frontend estimates are:

- Closed Vote registration: about 3 requests per voter.
- Closed Vote voting: about 4 to 5 requests per voter.
- Public Poll: about 3 to 4 requests per voter.

These do not include polling refreshes or an explicitly separate analytics
snapshot stream.
