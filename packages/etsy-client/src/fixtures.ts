/**
 * Spec-derived Etsy API fixtures loader.
 *
 * Reads the SYNTHETIC sample JSON under the repo-root `fixtures/` directory and
 * returns it typed against the generated Etsy v3 client types. Because the return
 * values are typed with `components["schemas"][...]`, any drift between a fixture
 * file and the real v3 schema is caught at `pnpm typecheck` time.
 *
 * The fixtures are NOT real Etsy data — see `fixtures/README.md`. They exist so the
 * M1–M3 pipeline (DuckDB schema, worker, estimator, scorer) can be built and tested
 * offline while the live Etsy app is in review (ETS-9). Never surface them as real
 * listings/shops/reviews/sales.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { components } from "./generated/etsy.js";

export type ShopListings = components["schemas"]["ShopListings"];
export type ShopListing = components["schemas"]["ShopListing"];
export type Shop = components["schemas"]["Shop"];
export type SellerTaxonomyNode = components["schemas"]["SellerTaxonomyNode"];
export type ListingReviews = components["schemas"]["ListingReviews"];
export type ListingReview = components["schemas"]["ListingReview"];

export interface EtsyFixtures {
  /** Active listings envelope ({ count, results }) — mirrors findAllActiveListingsByShop. */
  listings: ShopListings;
  /** A single shop — mirrors getShop. */
  shop: Shop;
  /** One seller-taxonomy node with children — mirrors getSellerTaxonomyNodes. */
  taxonomyNode: SellerTaxonomyNode;
  /** Listing reviews envelope ({ count, results }) — mirrors getReviewsByListing. */
  reviews: ListingReviews;
}

/** Absolute path to the repo-root `fixtures/` directory (works from src/ and dist/). */
export function fixturesDir(): string {
  // This package compiles to CommonJS, so __dirname is available. src/fixtures.ts and
  // dist/fixtures.js both sit one level under packages/etsy-client → repo root is ../../..
  return join(__dirname, "..", "..", "..", "fixtures");
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(fixturesDir(), file), "utf8")) as T;
}

/** Load all spec-derived fixtures, typed against the generated Etsy v3 client. */
export function loadFixtures(): EtsyFixtures {
  return {
    listings: readJson<ShopListings>("listings-active.json"),
    shop: readJson<Shop>("shop.json"),
    taxonomyNode: readJson<SellerTaxonomyNode>("taxonomy-node.json"),
    reviews: readJson<ListingReviews>("reviews-meta.json"),
  };
}
