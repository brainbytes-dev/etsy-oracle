# 02 — Stack Decision

**Decision:** TypeScript, monorepo (pnpm workspaces + Turborepo).

**Rationale:** Per `docs/PRODUCT-BRIEF.md` §4. The paid hosted tier comes later; laying the monorepo bones now means `apps/web`, auth, and billing drop in without restructuring. TypeScript gives type-safe generated clients from the Etsy OpenAPI spec and is the author's primary language.

**One language, no straddling.** All packages (`etsy-client`, `worker`, `db`, `scorer`) and `apps/cli` are TypeScript. No Python anywhere in the build.

## Package layout

```
etsy-oracle/
├── apps/
│   └── cli/               # apps/cli — `ingest`, `estimate`, `niches`, `status`
├── packages/
│   ├── etsy-client/       # Generated typed client + rate-limit/retry harness
│   ├── db/                # DuckDB schema + query helpers
│   ├── worker/            # Long-running ingestion worker
│   └── scorer/            # Sales estimator + niche opportunity scorer
├── package.json           # pnpm workspaces root
├── pnpm-workspace.yaml
└── turbo.json
```

## Toolchain

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥20 LTS | Runtime |
| pnpm | ≥9 | Package manager |
| Turborepo | latest | Monorepo task runner |
| TypeScript | ≥5.4 | Language |
| openapi-typescript | ≥7 | Type generation from Etsy OpenAPI spec |
| openapi-fetch | ≥0.12 | Type-safe fetch wrapper (zero-runtime overhead) |
| DuckDB Node.js | ≥1.1 | Embedded columnar store |
| tsx | latest | TS execution (dev), esbuild (prod build) |

## API client generation

Client types are generated from the official Etsy OpenAPI 3.0 spec:

```
https://www.etsy.com/openapi/generated/oas/3.0.0.json
```

The spec is vendored at `packages/etsy-client/etsy-openapi.json` and regenerated via `pnpm --filter etsy-client generate`. Never use an unofficial client library — the generated types are the single source of truth.

## Auth

- **API-key auth (keystring):** all v1 read endpoints (`findAllListingsActive`, `getListingsByShop`, reviews, etc.) use `x-api-key` header.
- **OAuth2:** reserved for member-scoped writes — not needed for v1.
- Secrets in `.env` (gitignored). Contract in `.env.example`.

**Committed by:** CTO (2026-06-09)
