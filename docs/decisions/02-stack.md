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

- **API-key auth (`x-api-key`):** every v1 read endpoint (`findAllListingsActive`, `getListingsByShop`, reviews, even the unscoped `openapi-ping`) requires the header as **`<keystring>:<shared_secret>`** — keystring and shared secret joined by a colon. The bare keystring is rejected. Source: Etsy `essentials/authentication` and `tutorials/quickstart` (via the Etsy Dev MCP). Both `ETSY_API_KEYSTRING` and `ETSY_SHARED_SECRET` are required; the client throws if either is missing.
- **OAuth2:** reserved for member-scoped writes — not needed for v1. (OAuth additionally sends a `Bearer` token, but the `x-api-key` colon header is still required even there.)
- Secrets in `.env` (gitignored). Contract in `.env.example`.

## M0 build notes (2026-06-09)

Findings from wiring the client against the real Etsy API:

- **`views` is not available.** The M0 done-when lists `views` as a column, but Etsy Open API v3 does **not** expose per-listing views on listing search (`findAllListingsActive`). `views` exists only on the `ShopListingWithAssociations` schema and is not returned by the search/active endpoints. The client prints the real fields — `listing_id`, `title`, `price`, `num_favorers`, `creation date` — and labels `views` as unavailable rather than fabricating it. `num_favorers` is the public-demand proxy the estimator uses downstream (consistent with the `etsy-v3-no-views-field` note). This does not block M0; it corrects one column the brief assumed.
- **`x-api-key` requires `<keystring>:<shared_secret>` — CORRECTION (ETS-11).** An earlier note here claimed the bare keystring works. That was wrong. The official spec (`essentials/authentication`: *"Every request to a v3 endpoint must include an `x-api-key` header containing your keystring and shared secret separated by a colon"*; `tutorials/quickstart` sends `x-api-key: 1aa2...fff:a1b2c3d4e5` even for the unscoped `openapi-ping`) requires the colon form on every request. The prior "verified" claim rested on a `403` from an invalid key — but a `403` fires regardless of header format, so it proved the request path, not the format. `client.ts` now composes `<keystring>:<shared_secret>` and throws if the secret is absent; `client.test.ts` pins the header value.

**Committed by:** CTO (2026-06-09)
