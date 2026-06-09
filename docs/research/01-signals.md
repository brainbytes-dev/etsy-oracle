# 01 — Signal Definition (M3.1, Market Researcher)

> **Owner:** Market Researcher. **Consumers:** CTO (implements M2 estimator and M3 scorer against this), CMO (positioning claims that rest on market facts).
> **Status:** Done — categories chosen, every signal mapped to a real Etsy Open API v3 field verified against the official spec, weighting recommended for M3.2, gut-check protocol defined.
> **Architecture is LOCKED** (official API v3, DuckDB, long-running worker, estimated sales). This doc does not re-derive it — it tells the scorer what to compute and from which fields.

This file answers two questions M3 depends on:

1. **Which Etsy categories/niches do we cover first, and why?**
2. **Which signals actually separate a good niche from a bad one, and how is each one observable from official Etsy Open API v3 fields?**

Every signal below is computable from the API. Anything that would need scraping is explicitly excluded. Field availability is verified against the official OpenAPI 3.0 spec (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`, retrieved 2026-06-09), not from memory or blog hearsay.

---

## 0. TL;DR for the CTO

- **Build the demand proxy on review-velocity, not views.** `views` does **not** exist in the v3 `ShopListing` schema (verified — 49 properties, no `views`). The brief's M2.1 lists "views" as an input; it is not obtainable from the API. Drop it. See [§2 realism flag #1](#flag-1--views-is-not-in-the-api-the-biggest-correction).
- **Review velocity is server-side windowable.** `getReviewsByListing` accepts `min_created` / `max_created` and the response carries a `count`. You get a trailing-90-day review count in **one call per listing** without paging all reviews. This is the single most important estimator input.
- **Competition is free and exact.** `findAllListingsActive` returns a `count` = "number of ShopListing resources found" for any `taxonomy_id` + `keywords` + price-band filter. That count *is* the supply/competition signal. No per-listing pulls needed to measure it.
- **Trend cannot come from a single pull.** No historical views, no historical favorers in the listing object. Trend must be a **delta across `listing_snapshots`** (M1.3). The scorer reads time-series, not one snapshot. Design the snapshot cadence to make this possible.
- **There is no "seller count per category" endpoint.** Derive it as distinct `shop_id` over the sampled listings, and label it an estimate.
- **Start coverage with digital downloads and print-on-demand niches** — not because they sell more, but because they are the cleanest to estimate and the highest-intent audience for a research tool. Rationale in [§3](#3-categories-to-cover-first).

---

## 1. The marketplace we are scoring (sourced context)

Real, primary-source figures (Etsy SEC filings, FY2025). Used only to ground category choices and CMO positioning — **not** fabricated, not extrapolated into per-niche sales.

- **86.5M active buyers** and **5.6M active sellers** on the Etsy marketplace as of **2025-12-31**. Source: Etsy 10-K / Q4 2025 8-K.
- **GMS per active buyer ≈ $120–121** on a trailing-twelve-month basis through 2025. Source: Etsy Q2/Q3 2025 8-K.
- Marketplace GMS was **declining year-over-year through 2025** (Q1 Etsy-marketplace GMS −8.1% currency-neutral). Source: Etsy Q1 2025 8-K. **Honesty note for the CMO:** Etsy is a large but *softening* market. Do not position etsy-oracle on "Etsy is booming." Position on "30 sellers a month is a lot to pay for estimates anyone can compute" — that claim holds regardless of GMS direction.

**Confidence: high** (primary SEC filings). Sources listed in [§8](#8-sources).

What this means for the scorer: ~5.6M sellers against 86.5M buyers is a **~15:1 buyer:seller ratio marketplace-wide**. A niche is attractive only when its *local* demand:supply ratio beats that baseline. The opportunity score is fundamentally a demand-vs-supply ratio, normalized per niche — see [§5](#5-the-opportunity-score-m32-recommendation).

---

## 2. Field-availability ground truth (the reference table)

Verified against the official OpenAPI 3.0 spec. This is the contract the scorer codes against. If a field is not in this table, it is not in the API — do not invent it.

### `ShopListing` (from `findAllListingsActive`, `getListingsByShop`, `getListingsByListingIds`)

| Field | Type | Used for | Notes |
|---|---|---|---|
| `listing_id` | int | join key | — |
| `shop_id` | int | seller-count proxy, dedup | distinct count per niche = seller estimate |
| `title` | string | niche/keyword classification | — |
| `tags` | array | niche/keyword classification | up to 13 tags; the real niche signal |
| `taxonomy_id` | int | **category assignment** | maps to `getSellerTaxonomyNodes` tree |
| `price` | Money | revenue estimate | `{amount, divisor, currency_code}` |
| `num_favorers` | int | **demand proxy (level)** | favorites count; available on every listing |
| `quantity` | int | inventory-depth / commitment signal | very high qty can signal POD/dropship |
| `creation_timestamp` / `original_creation_timestamp` | int (epoch s) | **listing age** | age = now − original_creation |
| `last_modified_timestamp` / `state_timestamp` | int (epoch s) | freshness / churn | re-list detection |
| `featured_rank` | int | seller-promoted signal | weak, optional |
| `has_variations` | bool | listing complexity | minor |
| `state` | string | filter to `active` | — |
| `views` | **ABSENT** | — | **NOT in the schema. See flag #1.** |

### `ListingReview` (from `getReviewsByListing`)

| Field | Type | Used for | Notes |
|---|---|---|---|
| `listing_id` | int | join key | — |
| `rating` | int (1–5) | quality / satisfaction signal | optional secondary signal |
| `created_timestamp` | int (epoch s) | **review velocity → sales proxy** | the core estimator input |
| `review` | string | (unused) | text, ignore for scoring |

### List-wrapper objects

| Object | Fields | Used for |
|---|---|---|
| `ShopListings` (search result) | `count`, `results` | **`count` = total competition** for the query |
| `ListingReviews` | `count`, `results` | `count` over a `min_created` window = velocity |

### `SellerTaxonomyNode` (from `getSellerTaxonomyNodes`)

| Field | Type | Used for |
|---|---|---|
| `id` | int | the `taxonomy_id` to filter searches on |
| `level` | int | depth in the category tree |
| `name` | string | human-readable niche label |
| `parent_id` | int | roll-up |
| `children` | array | drill-down to sub-niches |
| `full_path_taxonomy_ids` | array | breadcrumb for slicing |

### Relevant query parameters (the levers the worker pulls)

- `findAllListingsActive`: `taxonomy_id`, `keywords`, `min_price`, `max_price`, `sort_on` (`created`|`price`|`updated`|`score`), `sort_order`, `limit` (≤100), `offset` (≤12000 effective). **Price-band + keyword slicing is how you both (a) get past the 12k offset cap and (b) measure competition per sub-niche.**
- `getReviewsByListing`: `min_created`, `max_created`, `limit`, `offset`. **`min_created` lets the worker fetch only the trailing window — cheap velocity.**

**Confidence: high** (official spec, retrieved 2026-06-09).

---

### Critical realism flags (hand these to the CTO before M2/M3 code)

#### Flag 1 — `views` is NOT in the API. The biggest correction.

The PRODUCT-BRIEF (§2, §3) and milestone M2.1 list **views** as an estimator input. The v3 `ShopListing` object has 49 properties and **none of them is `views`** (it existed in the deprecated v2 API; it was removed in v3). The estimator must be built **without views**. This is not a nice-to-have — coding M2.1 against a `views` field will fail at runtime.

**Replace the demand inputs with what actually exists:**
- **Review velocity** (reviews in trailing N days, from `created_timestamp`) — *primary*, because a review is downstream of an actual order.
- **Favorers level** (`num_favorers`) — intent proxy, available now.
- **Favorers velocity** (Δ`num_favorers` between snapshots) — momentum, available only after M1.3 snapshots exist.
- **Listing age** (from `original_creation_timestamp`) — denominator that turns levels into rates.

#### Flag 2 — Review velocity → sales multiplier is category-dependent, not flat.

The estimator's weak point. Only a *fraction* of orders leave a review, and that fraction differs by category:
- **Digital downloads / instant-download:** many buyers, low review rate per order, but high volume → reviews undercount sales heavily. Multiplier is large and noisy.
- **Personalized / high-ticket physical (jewelry, custom signs):** higher review rate per order (buyers more invested), lower volume → multiplier smaller and more stable.

**Recommendation for M2.1:** do **not** ship one global `reviews × K = sales` constant. Make `K` a per-top-level-category parameter, default it conservatively, and expose it. M2.3 self-shop calibration is the right mechanism to tune `K` against a shop with known real sales — prioritize calibrating *per category*, not globally. **Until calibrated, label the multiplier a rough assumption, not a measurement.**

#### Flag 3 — Trend needs the snapshot table, not a single pull.

No field gives history. `creation_timestamp` tells you when the listing started, not how favorites/reviews grew. Trend = velocity computed across `listing_snapshots` (M1.3). If snapshots aren't running, the scorer must emit trend as `null`/`insufficient_data`, **not** a fabricated 0 or flat. Make "insufficient history" a first-class output state.

#### Flag 4 — "Number of sellers" is derived, not given.

There is no endpoint returning seller count per category. Approximate it as **distinct `shop_id` across the listings sampled for that niche**. This undercounts (you only see sampled listings) — label it `estimated_sellers` and prefer **listing count** (`ShopListings.count`, which *is* exact for the query) as the primary competition signal. Seller count is a secondary saturation input.

---

## 3. Categories to cover first

Selection criterion is **not** "biggest category." It is **estimate-cleanliness × audience-fit × ingestion-cheapness** — which niches let v1 produce a *trustworthy* ranked list fast, for the people who actually want this tool.

### Tier 1 (cover first)

1. **Digital downloads** (taxonomy under *Paper & Party Supplies → Paper*, *Art & Collectibles → Prints → Digital Prints*, *Craft Supplies → Patterns & How To*, etc.).
   - *Why:* No shipping profile, infinite `quantity`, zero fulfillment cost — the highest-margin, most "passive-income"-marketed niche, so the **research-tool audience is densest here** (this is exactly who pays EverBee). Pure listing-level economics: revenue ≈ price × estimated units, no shipping/material noise.
   - *Caveat:* worst review-rate undercount (flag 2) — calibrate `K` here first and hardest.
2. **Print-on-demand physical** (t-shirts, mugs, posters, wall art — under *Clothing*, *Home & Living → Wall Décor*).
   - *Why:* The other half of the "Etsy side-hustle" audience the brief targets. High listing volume → good statistics. POD shops often carry very high `quantity` and large tag overlap — useful saturation signals.

### Tier 2 (cover once Tier 1 ranks hold up)

3. **Jewelry** (*Jewelry* root taxonomy) — huge, high competition, higher review rate (more stable `K`); good for validating the estimator against a *different* multiplier regime.
4. **Home & Living / home decor** — broad, seasonal components (good trend/seasonality test bed).

### Explicitly deferred

- Vintage and one-of-a-kind / supplies where `quantity=1` dominates: low-volume, estimate is statistically meaningless per listing. Not a v1 niche-scoring target.

**How categories are enumerated in code:** call `getSellerTaxonomyNodes` once, cache the tree in DuckDB (`categories`/taxonomy table, M1.1). Each scored "niche" is a `taxonomy_id` (optionally narrowed by a keyword + price band). Start at `level` 1–2 nodes for Tier 1, drill into `children` for sub-niches.

**Confidence: medium-high.** Category *structure* is from the API (high). The *ranking* of which to do first is reasoned judgment about audience and estimate-cleanliness (medium) — not a sourced market stat, and labeled as such.

---

## 4. Signal definitions

Four signal families. Each: what it measures, the exact API source, the formula, and confidence. A niche = a `taxonomy_id` (± keyword ± price band).

### 4.1 Demand — "are buyers actually buying here?"

| Sub-signal | Source | Formula | Confidence |
|---|---|---|---|
| **Estimated demand (per niche)** | aggregate of per-listing estimates | `Σ est_units(listing)` over the niche's sampled top listings, scaled to population | medium (estimate) |
| **Per-listing estimated units** | `getReviewsByListing` count over trailing window | `reviews_in_window / review_rate(category)` → units/period; see flag 2 | medium |
| **Favorers level** | `ShopListing.num_favorers` | raw, and per-niche median/percentiles | high (raw), medium (as demand) |
| **Favorers velocity** | Δ`num_favorers` across `listing_snapshots` | `(fav_t2 − fav_t1)/(t2 − t1)` | medium; needs M1.3 |

Demand is an **estimate**. Label it everywhere (M2.2 honesty contract). Review velocity is the backbone because a review implies a real order; favorers are intent, not purchase.

### 4.2 Competition — "how much supply already exists?"

| Sub-signal | Source | Formula | Confidence |
|---|---|---|---|
| **Active listing count** | `ShopListings.count` from `findAllListingsActive(taxonomy_id, …)` | direct read | **high (exact)** |
| **Estimated seller count** | distinct `ShopListing.shop_id` over sample | `nunique(shop_id)` | low-medium (flag 4) |
| **Listings-per-seller** | derived | `listing_count / distinct_sellers` | medium |

Listing count is the cleanest, cheapest, most exact signal in the whole system — one search call per niche returns it. High listings-per-seller can indicate POD spam flooding (a saturation tell).

### 4.3 Saturation — "is this niche crowded *and* stagnant?"

Saturation is the interaction of high competition with **flat or falling demand momentum** — a dying niche, not just a busy one. This is why trend (4.4) and competition (4.2) must be combined, not scored independently.

| Sub-signal | Source | Formula | Confidence |
|---|---|---|---|
| **Demand-per-listing** | demand (4.1) ÷ listing count (4.2) | `est_demand / listing_count` | medium |
| **Favorers concentration** | `num_favorers` distribution across niche | Gini / top-10% share of favorers | medium |
| **New-listing inflow** | `findAllListingsActive(sort_on=created)` | count of listings with `original_creation_timestamp` in trailing window | high (observable) |

**Saturation tell:** high listing count **+** high new-listing inflow **+** flat favorers/review velocity = sellers pouring in while demand isn't growing. That is the crowded-dying-niche pattern the brief warns about. Favorers concentration catches winner-take-all niches where a few listings own all demand and a new entrant can't break in.

### 4.4 Trend / seasonality — "rising, flat, or a seasonal spike?"

**Only observable from time-series snapshots (M1.3). A single pull cannot produce trend.**

| Sub-signal | Source | Formula | Confidence |
|---|---|---|---|
| **Demand momentum** | review-velocity across snapshots | slope of reviews/period over trailing snapshots | medium; needs history |
| **Favorers momentum** | Δ`num_favorers` across snapshots | normalized slope | medium; needs history |
| **New-entrant rate** | `original_creation_timestamp` cohorts | listings created per month, last N months | high |
| **Seasonality** | ≥1 year of snapshots, or `created_timestamp` seasonality | month-of-year index | low until ≥12mo history |

**Rising vs seasonal-spike discrimination:** a rising niche shows sustained positive demand momentum *and* rising new-entrant rate over multiple snapshots; a seasonal spike shows a sharp velocity bump that decays and recurs at the same month-of-year. The scorer cannot tell these apart from <1 snapshot cycle — until then, emit `trend: insufficient_data` (flag 3). Do not fake it.

---

## 5. The opportunity score (M3.2 recommendation)

The score is a **demand-vs-supply ratio, adjusted by momentum and penalized by saturation.** Keep it auditable (M3.3 requires components visible) — no black box.

Recommended shape (CTO owns final weighting; this is the starting point to calibrate):

```
opportunity = w_d · norm(demand)            // 4.1, estimated — the upside
            − w_c · norm(competition)        // 4.2, exact listing count — the cost of entry
            + w_t · norm(trend_momentum)     // 4.4, null if insufficient history
            − w_s · norm(saturation)         // 4.3, the crowded-and-stagnant penalty
```

Starting weights to calibrate against the gut-check (§6): `w_d = 0.40, w_c = 0.30, w_t = 0.20, w_s = 0.10`. Demand and competition dominate because they are the most directly observable; trend is down-weighted until snapshot history is deep enough to trust.

**Normalization:** per-category percentile rank (not raw), so a niche is scored relative to its peers, not across incomparable categories. Compare digital-download niches to other digital-download niches.

**Auditability requirements (M3.3):**
- Output every component column raw next to the score: `est_demand`, `listing_count`, `est_sellers`, `trend`, `saturation`.
- Tag `est_demand` and anything derived from it `(estimate)`.
- When `trend = insufficient_data`, show it and set `w_t` contribution to 0 for that row — don't silently impute.

---

## 6. Validation & gut-check protocol (how I sign off M3)

M3 closes only when the scorer's ranked output survives a manual gut-check. My acceptance procedure:

1. **Order-of-magnitude sanity.** For the top-3 ranked niches, the listing count (exact) must match reality within an order of magnitude (e.g. "personalized dog collars" should be thousands–tens-of-thousands of listings, not 12 and not 12 million). If the count is absurd, the niche definition (taxonomy/keyword) is wrong.
2. **Known-niche placement.** Niches that are obviously saturated to any Etsy seller (generic "t-shirt", "wall art", "sticker") must **not** rank top. If they do, the saturation/competition penalty is too weak.
3. **Estimate plausibility.** Pick one listing per top niche with a knowable order-of-magnitude (e.g. a shop with a public sales count or a clearly tiny/huge shop) and check the estimated units land in the right decade. Per M2 done-criteria.
4. **Trend honesty.** Any niche scored on trend must have real snapshot history behind it; spot-check that `insufficient_data` is shown where history is thin, not faked.
5. **Verdict written back to the issue** as a pass/fail with the specific failing rows, handed to the CTO if re-weighting is needed.

I cannot run steps 1–4 until the CTO has M1 ingestion producing real rows and M2/M3 producing a real ranked list. **This signals doc (M3.1) is complete and unblocks M3.2 now;** the gut-check (validation of M2/M3) is a separate task that depends on the CTO's running output.

---

## 7. Handoffs

- **→ CTO (M2/M3):** Build the estimator on review-velocity + favorers (+ snapshot velocity) + age. **Drop `views` (flag 1).** Make the review→sales multiplier per-category and calibratable (flag 2). Use `ShopListings.count` as the competition signal and `getReviewsByListing` `min_created` windowing for cheap velocity. Emit `trend: insufficient_data` until snapshots are deep (flag 3). Score = demand−competition+trend−saturation with the §5 weights as a starting point.
- **→ CMO (positioning):** Real, sourced marketplace facts in [§1] are usable in the README. Etsy is large (86.5M buyers / 5.6M sellers, 2025) but GMS is softening — position on cost-of-estimates, not on "Etsy is booming." Do not invent per-niche sales numbers.
- **→ CEO:** No architecture change requested. One brief-vs-reality discrepancy surfaced and resolved in-doc (the brief lists `views`, which v3 does not expose); flagged to the CTO rather than silently changed. Raising here for visibility, not as a blocker.

---

## 8. Sources

- **Etsy Open API v3 — official OpenAPI 3.0 spec.** `https://www.etsy.com/openapi/generated/oas/3.0.0.json` (retrieved 2026-06-09). Authoritative for `ShopListing`, `ListingReview`, `ShopListings`/`ListingReviews` wrappers, `SellerTaxonomyNode`, and all endpoint parameters. Tier 1 (primary).
- **Etsy Open API v3 — Reference & Rate Limits.** `https://developers.etsy.com/documentation/reference/`, `https://developers.etsy.com/documentation/essentials/rate-limits/` (10,000 requests/day, 10 QPS; `fields` partial-resource param removed in v3; list endpoints return `count`+`results`). Tier 1.
- **Etsy, Inc. SEC filings, FY2025** (active buyers 86.5M / active sellers 5.6M as of 2025-12-31; GMS/active buyer ≈ $120–121 TTM; marketplace GMS declining YoY). Q1 8-K `https://www.sec.gov/Archives/edgar/data/0001370637/000137063725000038/exhibit991q12025.htm`; Q2 `…000064/exhibit991q22025.htm`; Q3 `…000098/exhibit991q32025.htm`; 10-K via `https://www.stocktitan.net/sec-filings/ETSY/`. Tier 1 (primary financial disclosure).

**Confidence labeling:** API field availability and rate limits — *high* (primary spec). Marketplace scale figures — *high* (SEC). Category-priority ordering and signal weights — *medium* (reasoned judgment, to be calibrated against real ranked output in §6); labeled as such, not presented as measured fact.
