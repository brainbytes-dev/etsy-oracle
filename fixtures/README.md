# fixtures/ — spec-derived Etsy API samples (SYNTHETIC, not real data)

> **These are NOT real Etsy listings, shops, reviews, or sales.**
> Every record here is hand-authored synthetic data whose **field shapes** are copied
> field-for-field from the official Etsy Open API v3 schemas (sourced via the Etsy Dev
> MCP `get_schema` / `get_endpoint`, not from memory). The **values** are invented.
> They exist so M1–M3 (DuckDB schema, ingestion worker, estimator, niche scorer) can be
> built and tested while the live Etsy app sits in review ([ETS-9](../docs/decisions/01-milestones.md)).

## Hard rule

**Never surface these as real listings, real shops, real reviews, or real sales** in any
user-facing surface (CLI output, README, future UI). They are test fixtures only. Real
output requires the live API (ETS-9 approval). Markers that make this unmissable:

- All synthetic IDs use out-of-range high prefixes: `listing_id` `90000000xx`,
  `shop_id` `70000000xx`, `user_id` `80000000xx`.
- Every `title`/`description`/`review` string contains the word `SYNTHETIC` or the
  literal `SYNTHETIC FIXTURE`.
- Shop name is `SyntheticFixtureStudio`.

## Files

| File | Etsy v3 schema | Envelope | Endpoint it mirrors |
| --- | --- | --- | --- |
| `listings-active.json` | `ShopListing[]` (+ nested `Money`) | `ShopListings` (`{ count, results }`) | `findAllActiveListingsByShop` / `findAllListingsActive` |
| `shop.json` | `Shop` | bare object | `getShop` |
| `taxonomy-node.json` | `SellerTaxonomyNode` (recursive `children`) | bare object | `getSellerTaxonomyNodes` (one node) |
| `reviews-meta.json` | `ListingReview[]` | `ListingReviews` (`{ count, results }`) | `getReviewsByListing` |

## Field provenance

Field names and types match the v3 schemas exactly, including Etsy's duplicated
timestamp aliases (`creation_timestamp` + `created_timestamp`,
`create_timestamp` + `created_timestamp`, etc.). `views` is intentionally absent —
it is **not** a field on the v3 `ShopListing` schema (see
`docs/research/01-signals.md` flag #1); the estimator uses review-velocity, favorers,
and listing age instead.

## Loader

Read these in code/tests via the typed loader in `@etsy-oracle/etsy-client`:

```ts
import { loadFixtures } from "@etsy-oracle/etsy-client";

const { listings, shop, taxonomyNode, reviews } = loadFixtures();
// listings: components["schemas"]["ShopListings"]  — typed against the generated client
```

The loader validates each record against the generated OpenAPI types at compile time, so
a drift between these fixtures and the real v3 schema is caught by `pnpm typecheck`.
