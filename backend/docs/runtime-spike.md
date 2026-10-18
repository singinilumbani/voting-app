# Express on Cloudflare Workers runtime spike

## Result

Express serves the same health route in Node and in Wrangler's local Workers runtime through Cloudflare's documented `httpServerHandler` from `cloudflare:node`. The Node process is started with `app.listen`; the Worker entry exports the port-based `httpServerHandler` and enables `nodejs_compat`.

## Versions and configuration

- Node.js: `v26.8.2` (the host did not have Node 22 installed)
- pnpm: `12.4.1`
- Wrangler: `4.151.0`
- Express: `5.2.1`
- Zod: `4.6.7`
- Wrangler compatibility date: `2026-10-15`
- Compatibility flags: `nodejs_compat`
- Wrangler-generated Worker runtime types: `workerd@1.20261012.1`

## Validation

- Node health endpoint: `GET http://127.0.0.1:8788/api/v1/health` returned HTTP 200 and `{ "status": "ok", "env": "development", "time": "<UTC ISO 8601>" }`.
- Workers health endpoint: `GET http://127.0.0.1:8787/api/v1/health` returned the same HTTP 200 response shape in local Wrangler.
- Existing JavaScript backend: `pnpm dev:legacy` started on port 5000 and `GET /` returned its existing health message.
- `wrangler deploy --dry-run --config wrangler.toml`: passed; no deployment was made.
- Bundle size: `1942.78 KiB` uncompressed, `420.96 KiB` gzip, as reported by Wrangler. Wrangler reported no bindings in the dry-run configuration.
- Focused verification: `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed; 5 tests passed.

## Limits and recommendation

This validates only startup and a lightweight health response. It does not exercise database drivers, database bindings/connections, authentication, file uploads, scheduled jobs, production secrets, cold-start behavior, concurrency, or load. CPU time was not measured. The specification's Workers free-tier limits (10 ms CPU per request, 100,000 requests per day, and 50 subrequests per invocation) remain unverified constraints, not benchmark results.

**Recommendation:** retain Express for the initial backend skeleton; the documented compatibility path worked for the required runtime spike, so a framework change is not warranted. Before implementing database-backed modules, run a separate compatibility and latency check for each Node-specific dependency and Neon access pattern. Revisit a move to Hono only if those checks show Express or a required dependency is unreliable on Workers. Rerun the checks under Node 22 before merge.

## Host password-hash benchmark (2026-10-18)

`pnpm password:benchmark` uses the same Web Crypto PBKDF2-SHA256 implementation as host authentication and reports the median elapsed time across five hashes. On Node.js v26.8.2, the selected 5,000-iteration default measured **3.92-4.61 ms median** across runs. A 10,000-iteration configuration measured between **6.76 ms and 12.97 ms median** across runs; a separate 100,000-iteration run measured **65.38 ms median**. These are elapsed-time measurements on Node, not Workers CPU measurements. The Workers runtime spike has not yet exercised PBKDF2, so confirm the configured iteration count on the deployed Workers class before enabling host signup; increase it only if the platform measurement leaves adequate headroom. The selected default is deliberately conservative for CPU and should be revisited with a Workers benchmark because more iterations improve resistance to offline password guessing.
