/**
 * client.ts — auth header contract.
 *
 * The Etsy Open API v3 requires the x-api-key header as "<keystring>:<shared_secret>"
 * on EVERY request (essentials/authentication + tutorials/quickstart openapi-ping).
 * These tests pin that format so a regression to the bare keystring is caught.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEtsyClient } from "./client.js";

/** A temp counter path so the rate limiter never touches the repo's data dir. */
function tmpCounter(): string {
  return join(mkdtempSync(join(tmpdir(), "etsy-rl-")), "counter.json");
}

test("x-api-key is sent as <keystring>:<shared_secret>", async () => {
  let captured: string | null = null;
  const fakeFetch: typeof fetch = async (input) => {
    const req = input as Request;
    captured = req.headers.get("x-api-key");
    return new Response(JSON.stringify({ application_id: 1234 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const etsy = createEtsyClient({
    apiKey: "1aa2bb33c44d55eeeeee6fff",
    sharedSecret: "a1b2c3d4e5",
    fetch: fakeFetch,
    rateLimiterOptions: { counterFilePath: tmpCounter(), minIntervalMs: 0 },
  });

  await etsy.GET("/v3/application/openapi-ping");

  assert.equal(captured, "1aa2bb33c44d55eeeeee6fff:a1b2c3d4e5");
});

test("throws a clear error when the shared secret is absent", () => {
  assert.throws(
    () =>
      createEtsyClient({
        apiKey: "1aa2bb33c44d55eeeeee6fff",
        sharedSecret: undefined,
        rateLimiterOptions: { counterFilePath: tmpCounter() },
      }),
    /ETSY_SHARED_SECRET is required/
  );
});

test("throws when the keystring is absent", () => {
  assert.throws(
    () =>
      createEtsyClient({
        apiKey: undefined,
        sharedSecret: "a1b2c3d4e5",
        rateLimiterOptions: { counterFilePath: tmpCounter() },
      }),
    /ETSY_API_KEYSTRING is required/
  );
});
