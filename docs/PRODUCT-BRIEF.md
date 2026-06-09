# PRODUCT BRIEF — etsy-oracle

> A free, open-source, self-hostable Etsy product-research tool. The free alternative to EverBee, eRank, and Sale Samurai. We built it ourselves to stop paying 30 dollars a month for estimates anyone can compute.

## 1. The promo / why it exists

The paid Etsy research tools (EverBee at ~30 USD per month, eRank, Sale Samurai) sell "estimated sales and revenue" as if they had secret data. They do not. They run a proprietary estimate from public signals: reviews, favorites, views, listing age. etsy-oracle computes the same thing from the official Etsy API, for free, self-hosted, no subscription. That is the launch story and the README headline.

## 2. What it does

1. **Bestseller / sales estimator.** Per listing: estimated sales and revenue, plus trend, derived from review-velocity, favorers, views, and listing age. Calibratable against the user's own shop (where real sales are known) for accuracy.
2. **Niche opportunity finder (the core value).** Per niche or category: demand (estimated sales) versus competition (number of listings and sellers) versus saturation versus trend, combined into an opportunity score. Surfaces underserved niches where there is still money to make.
3. **Bulk category database.** Pulls Etsy listing data by category over time into a local analytical store, so analyses run on a large dataset, not a handful of live lookups.

## 3. Architecture (DECIDED, do not re-derive)

- **Data source: the official Etsy Open API v3 only. No HTML scraping.** Scraping breaks when Etsy changes its HTML and risks DMCA takedown of a public repo. The API is legal, gives the needed signals, and allows 10,000 requests per day per key, with up to 100 listings batched per call.
- **Sales are ESTIMATED, not real.** Etsy does not expose per-listing units-sold. Use the reviews endpoint (review count and timestamps) for velocity, plus favorers, views, and listing age. Be honest in the UI: these are estimates, roughly 80 percent accurate, better for high-volume listings. Never present them as exact.
- **Store: DuckDB.** Columnar, embedded, handles 100M+ rows on a single machine cheaply. This is the bulk analytical store. Not Neon or transactional Postgres for the bulk data. For a Vercel UI to query it, use MotherDuck (hosted DuckDB) or sync computed niche-scores into a small read table.
- **Ingestion is a long-running worker, NOT a Vercel serverless function** (function time limits, and Henrik's hard Vercel cost rule). The worker (homeserver / Coolify / a cron) pulls the API and writes DuckDB. Any UI on Vercel reads precomputed aggregates only.
- **Full category coverage is possible over time** by slicing past the 12,000-offset search cap (sub-keywords, price bands, date filters). Throughput is bounded by the 10k/day API limit; it fills gradually. Reviews cost ~1 call per listing, so pull review-velocity only for top candidates, not every listing.

## 4. Stack and foundation

- **TypeScript, in a monorepo on Henrik's standard foundation** (pnpm workspaces + Turborepo, the `nextjs-expo-saas-starter` conventions). Reason: the hosted, minimally-paid version comes later (see roadmap), and laying the monorepo bones now means the web dashboard, auth, and billing drop in later without restructuring.
- v1 ships ONLY the core packages: `packages/etsy-client` (generated from Etsy's official OpenAPI 3.0 spec, not a random GitHub repo), `packages/worker` (ingestion), `packages/db` (DuckDB schema), `packages/scorer` (estimator + opportunity scorer), and `apps/cli`.
- The SaaS layer (a Next.js `apps/web` dashboard, auth, Stripe) is **scaffolded-for in the structure but NOT built in v1.** Do not add Stripe, auth, or Expo cruft now; leave clean seams.
- DuckDB for the store, queried in-process by the worker and CLI.

## 5. Out of scope for v1

No paid features, no accounts, no web UI, no scraping. v1 is: the core packages above plus a killer README. The hosted version and launch come after v1 runs locally.

## 6. Roadmap beyond v1

- Web dashboard (`apps/web`, Next.js) reading precomputed aggregates.
- Optional hosted version with a minimal paid tier, on the same monorepo, when the core proves itself. The open-source self-host path stays free and first-class.
