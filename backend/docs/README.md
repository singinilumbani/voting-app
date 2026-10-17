# Backend documentation

This directory contains the backend specification, developer guidance, API reference, prompt pack, audit, and implementation history.

## Files

- [DEVELOPMENT.md](./DEVELOPMENT.md) — install, run, build, typecheck, lint, test, and format commands for this backend.
- [api.md](./api.md) — current legacy HTTP endpoints, authorization, request/response shapes, and error keys.
- [runtime-spike.md](./runtime-spike.md) — Express compatibility check in Node and Wrangler's local Workers runtime.
- [legacy-audit.md](./legacy-audit.md) — read-only inventory and gap analysis of the original applications.
- [project-specification.md](./project-specification.md) — the product specification; retained as supplied.

## Folders

- [build-prompts/](./build-prompts/) — modular prompts for the backend build.
- [implementation-log/](./implementation-log/) — one implementation record per project module, including the M0 audit, M1 tooling, and M2 backend skeleton.
