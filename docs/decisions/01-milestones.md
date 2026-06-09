# 01 — Milestones (etsy-oracle v1)

> Decomposition of `docs/PRODUCT-BRIEF.md` into shippable milestones.
> Architecture is **LOCKED** (official Etsy Open API v3, DuckDB, long-running worker, estimated sales). This file does not re-derive it — it sequences the build.
>
> **Definition of done is RUNNING, not compiling.** Every milestone closes only when an agent has executed it and shown the real output: real API listings, real DuckDB rows, a real ranked niche list. "It compiles" / "it should work" is rejected.

Status legend: ☐ not started · ◐ in progress · ☑ done (with real output shown)

---

## M0 — Foundations & API access (CTO)

The thing that unblocks everything. No data without a working authenticated client.

- ☐ **M0.1 Etsy API key + auth.** Register an Etsy developer app, obtain the API key (keystring). OAuth2 personal access for the endpoints that need it. Document the env-var contract (`.env.example`, never commit secrets).
- ☐ **M0.2 Language commit.** CTO picks TypeScript **or** Python and commits in writing in `docs/decisions/02-stack.md`. One language, no straddling.
- ☐ **M0.3 Generated API client.** Client generated from Etsy's official OpenAPI 3.0 spec — **not** a random GitHub repo. Typed, with rate-limit handling baked in (10k requests/day, 100 listings/batch).
- ☐ **M0.4 Rate-limit + retry harness.** Token-bucket or equivalent so we never blow the daily cap; exponential backoff on 429/5xx; persistent counter that survives restarts.

**Done when:** a single command authenticates and prints N real listings (title, listing_id, price, num_favorers, creation date) pulled live from `findAllListingsActive` / `getListingsByShop`. Paste the real JSON in the issue. (Note: `views` is **not** in the v3 `ShopListing` schema — see `docs/research/01-signals.md` flag #1; do not expect it in the output.)

---

## M1 — DuckDB schema & ingestion worker (CTO)

The bulk store and the long-running puller. **Worker, never a Vercel serverless function.**

- ☐ **M1.1 DuckDB schema.** Tables for `listings`, `shops`, `listing_snapshots` (time-series for trend), `reviews_meta`, `categories`/taxonomy, plus an `ingestion_runs` audit table. Columnar, made for 100M+ rows. Schema in `docs/decisions/03-schema.md`.
- ☐ **M1.2 Ingestion worker.** Long-running process (homeserver / Coolify / cron) that walks a category, batches listing pulls, writes to DuckDB, and is resumable (checkpoint offset/keyword/price-band). Honors the 12k search-offset cap via slicing (sub-keywords, price bands, date filters).
- ☐ **M1.3 Snapshot cadence.** Re-pull selected listings on a schedule to build review-velocity / favorer / view deltas over time (the raw material for sales estimates).
- ☐ **M1.4 Reviews pull (selective).** Reviews cost ~1 call/listing — pull review timestamps only for top candidates, not the whole category. Enforce that selectivity in code.

**Done when:** the worker runs against one real category (e.g. one print-on-demand niche), writes ≥10k real rows to DuckDB, and a `SELECT count(*)`, plus a sample of 10 rows, is pasted in the issue. Show it survived a restart and resumed.

---

## M2 — Sales/revenue estimator (CTO, signals validated by Market Researcher)

The headline feature. The thing EverBee charges for.

- ☐ **M2.1 Estimation model.** Estimated units sold + revenue per listing from review-velocity (primary), favorers level + velocity, and listing age. Documented method, transparent formula — no black box, no fabricated numbers. **`views` is unavailable in v3** (see `docs/research/01-signals.md` flag #1) — the brief's mention of views is superseded; do not code against it. The review→sales multiplier `K` is per-category, not flat (flag #2).
- ☐ **M2.2 Honesty contract.** Every estimate is labelled an estimate everywhere it appears (CLI, future UI, README). Never presented as exact. State the rough accuracy band and that it is better for high-volume listings.
- ☐ **M2.3 Self-shop calibration.** Allow calibrating the model against a shop whose real sales are known (the user's own), to tune the multiplier.

**Done when:** estimator runs over the M1 dataset and prints estimated sales + revenue for 20 real listings, each tagged `(estimate)`, with the method documented. Sanity-checked against at least one listing with a knowable order-of-magnitude.

---

## M3 — Niche opportunity scorer (CTO + Market Researcher) — THE CORE VALUE

Per niche: demand vs competition vs saturation vs trend → one opportunity score. Surfaces underserved niches.

- ☐ **M3.1 Signal definition (Market Researcher).** Which Etsy categories/niches to cover first, and which signals actually separate a good niche from a bad one. Written to `docs/research/01-signals.md`.
- ☐ **M3.2 Scorer.** Combine estimated demand (M2) vs competition (listing/seller counts) vs saturation vs trend into a score per niche. Documented weighting.
- ☐ **M3.3 Ranked output.** Produce a ranked niche list with the components visible (so the score is auditable, not magic).

**Done when:** the scorer outputs a real ranked list of niches from real ingested data, with demand/competition/trend columns shown, and the top result holds up to a manual gut-check. Paste the ranked table.

---

## M4 — CLI (CTO)

CLI first, per the brief. The usable surface for v1.

- ☐ **M4.1 Commands.** `ingest <category>`, `estimate <listing|shop>`, `niches [--top N]`, `status` (quota/coverage).
- ☐ **M4.2 Output.** Human-readable tables + machine-readable (JSON/CSV) export. Estimates labelled as estimates in the output itself.

**Done when:** a fresh checkout can run `niches --top 20` against the local DuckDB and get a real ranked list. Recorded terminal output in the issue.

---

## M5 — README & positioning (CMO)

The launch story: "the free alternative to EverBee." Drafted, **not posted** (launch is Henrik's call; guardrails forbid premature publishing).

- ☐ **M5.1 README.** What it is, the honest "they sell estimates anyone can compute" promo, install/run, the estimate-honesty disclaimer, architecture overview, contribution notes.
- ☐ **M5.2 Positioning doc.** "Free alternative to EverBee/eRank/Sale Samurai" framing, grounded in real differences — no fabricated stats, no traction claims, pre-launch honesty only.
- ☐ **M5.3 Launch copy drafts.** Product Hunt / Reddit / HN drafts written and parked. **Do not post.**

**Done when:** README renders, every claim is true and non-fabricated, install steps actually work against the built CLI, and the quality-gate passes. Henrik reviews before any publish.

---

## M6 — Web UI (POST-v1, do not start yet)

Out of scope until v1 CLI runs. Recorded so it isn't forgotten.

- ☐ Vercel UI reads **precomputed aggregates only** (MotherDuck or a synced niche-score read table). No ingestion on Vercel. No serverless ingestion. Respect Henrik's Vercel cost rules.

---

## Sequencing & ownership

```
M0 (CTO) ─► M1 (CTO) ─► M2 (CTO) ─► M3 (CTO+Researcher) ─► M4 (CTO)
                                  ▲
M3.1 signals (Market Researcher) ─┘  (can start in parallel during M0/M1)
M5 README/positioning (CMO)  ── can draft in parallel from M2 onward; finalised after M4 runs
M6 Web UI ── parked until v1 CLI runs
```

- **CTO** owns M0–M4 (API client, worker, schema, estimator, scorer, CLI).
- **Market Researcher** owns M3.1 signals and validates M2/M3 inputs; can start during M0/M1.
- **CMO** owns M5; drafts in parallel, finalises after M4 is RUNNING.
- **CEO** coordinates, reviews, integrates, unblocks. Does not build.

## Cross-cutting guardrails (binding on every milestone)

- Repo is public on GitHub (Henrik allowed early public). The quality gate governs what ships — never push broken, placeholder, unbranded, or fabricated commits. A public *launch* (HN/Reddit/Product Hunt) is Henrik's call only.
- Official API only. No HTML scraping, ever.
- Sales are estimates. Labelled as such everywhere. Never exact.
- No fabricated data anywhere — code, output, README, UI.
- Done = RUNNING with real output shown. Not "compiles."
