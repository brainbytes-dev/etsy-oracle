/**
 * fixtures.ts — the spec-derived fixtures load and match the v3 schema field-for-field.
 *
 * These assertions pin the shape the M1–M3 pipeline consumes: the response envelopes
 * ({ count, results }), the estimator inputs (num_favorers, original_creation_timestamp,
 * review timestamps), and the synthetic-data guardrail (nothing here may masquerade as
 * real Etsy data).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixtures } from "./fixtures.js";

test("listings fixture is a ShopListings envelope with matching count", () => {
  const { listings } = loadFixtures();
  assert.equal(typeof listings.count, "number");
  assert.ok(Array.isArray(listings.results));
  assert.equal(listings.count, listings.results!.length);
  assert.ok(listings.results!.length >= 5);
});

test("each listing carries the estimator-input fields with correct types", () => {
  const { listings } = loadFixtures();
  for (const l of listings.results!) {
    assert.equal(typeof l.listing_id, "number");
    assert.equal(typeof l.title, "string");
    assert.equal(typeof l.num_favorers, "number");
    assert.equal(typeof l.original_creation_timestamp, "number");
    assert.equal(l.state, "active");
    // taxonomy_id drives niche grouping (M3)
    assert.equal(typeof l.taxonomy_id, "number");
    // price is the nested Money schema
    assert.equal(typeof l.price!.amount, "number");
    assert.equal(typeof l.price!.divisor, "number");
    assert.equal(typeof l.price!.currency_code, "string");
  }
});

test("views is intentionally absent from listings (not a v3 field)", () => {
  const { listings } = loadFixtures();
  for (const l of listings.results!) {
    assert.ok(!("views" in l), "v3 ShopListing has no `views` field");
  }
});

test("shop fixture exposes the niche signals (transaction count, review stats)", () => {
  const { shop } = loadFixtures();
  assert.equal(typeof shop.shop_id, "number");
  assert.equal(typeof shop.transaction_sold_count, "number");
  assert.equal(typeof shop.review_count, "number");
  assert.equal(typeof shop.review_average, "number");
});

test("taxonomy node is recursive with a full_path_taxonomy_ids chain", () => {
  const { taxonomyNode } = loadFixtures();
  assert.equal(typeof taxonomyNode.id, "number");
  assert.equal(typeof taxonomyNode.level, "number");
  assert.ok(Array.isArray(taxonomyNode.children));
  assert.ok(Array.isArray(taxonomyNode.full_path_taxonomy_ids));
  for (const child of taxonomyNode.children!) {
    assert.equal(child.parent_id, taxonomyNode.id);
  }
});

test("reviews fixture is a ListingReviews envelope with velocity timestamps", () => {
  const { reviews } = loadFixtures();
  assert.equal(reviews.count, reviews.results!.length);
  for (const r of reviews.results!) {
    assert.equal(typeof r.create_timestamp, "number");
    assert.ok(r.rating! >= 1 && r.rating! <= 5);
    assert.equal(typeof r.listing_id, "number");
  }
  // timestamps must be ascending-capable (sortable) for review-velocity math
  const ts = reviews.results!.map((r) => r.create_timestamp!);
  assert.deepEqual([...ts].sort((a, b) => a - b), ts);
});

test("every fixture record is unmistakably synthetic, never real Etsy data", () => {
  const { listings, shop, reviews } = loadFixtures();
  // High out-of-range ID prefixes mark synthetic records.
  for (const l of listings.results!) {
    assert.ok(l.listing_id! >= 9_000_000_000, "synthetic listing_id prefix");
    assert.match(l.description!, /SYNTHETIC/);
  }
  assert.match(shop.shop_name!, /Synthetic/i);
  for (const r of reviews.results!) {
    assert.match(r.review!, /SYNTHETIC/);
  }
});
