import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry, EtsyApiError } from "./retry.js";

const fast = { initialDelayMs: 1, maxDelayMs: 5 } as const;

test("retries a 429 then succeeds, reporting attempts", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new EtsyApiError(429, "Too Many Requests", 1);
    return "ok";
  }, { maxAttempts: 5, ...fast });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("retries a 503 server error", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw new EtsyApiError(503, "Service Unavailable");
    return 42;
  }, { maxAttempts: 4, ...fast });
  assert.equal(result, 42);
  assert.equal(calls, 2);
});

test("does NOT retry a 4xx client error (other than 429)", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(async () => {
        calls++;
        throw new EtsyApiError(400, "Bad Request");
      }, { maxAttempts: 5, ...fast }),
    (err: unknown) => err instanceof EtsyApiError && err.status === 400
  );
  assert.equal(calls, 1, "a 400 must not be retried");
});

test("gives up after maxAttempts and throws the last error", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(async () => {
        calls++;
        throw new EtsyApiError(500, "Internal Server Error");
      }, { maxAttempts: 3, ...fast }),
    (err: unknown) => err instanceof EtsyApiError && err.status === 500
  );
  assert.equal(calls, 3);
});

test("retries network (TypeError) errors from fetch", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw new TypeError("fetch failed");
    return "recovered";
  }, { maxAttempts: 3, ...fast });
  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});

test("fires the onRetry callback before each retry", async () => {
  const reasons: string[] = [];
  let calls = 0;
  await withRetry(async () => {
    calls++;
    if (calls < 2) throw new EtsyApiError(429, "slow down", 1);
    return "ok";
  }, { maxAttempts: 3, onRetry: (_a, _d, reason) => reasons.push(reason), ...fast });
  assert.deepEqual(reasons, ["HTTP 429"]);
});
