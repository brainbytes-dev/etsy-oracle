import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EtsyRateLimiter, EtsyRateLimitExhaustedError } from "./rate-limiter.js";

function tmpCounter(): string {
  const dir = mkdtempSync(join(tmpdir(), "etsy-rl-"));
  return join(dir, "counter.json");
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

test("counts usage and computes remaining", async () => {
  const rl = new EtsyRateLimiter({ dailyLimit: 10, minIntervalMs: 0, counterFilePath: tmpCounter() });
  assert.equal(rl.used, 0);
  assert.equal(rl.remaining, 10);
  await rl.acquire();
  await rl.acquire();
  assert.equal(rl.used, 2);
  assert.equal(rl.remaining, 8);
});

test("throws when the daily budget is exhausted", async () => {
  const rl = new EtsyRateLimiter({ dailyLimit: 2, minIntervalMs: 0, counterFilePath: tmpCounter() });
  await rl.acquire();
  await rl.acquire();
  assert.equal(rl.isExhausted, true);
  await assert.rejects(() => rl.acquire(), EtsyRateLimitExhaustedError);
});

test("persists the counter across restarts (same key, same day)", async () => {
  const path = tmpCounter();
  const a = new EtsyRateLimiter({ dailyLimit: 100, minIntervalMs: 0, counterFilePath: path });
  await a.acquire();
  await a.acquire();
  await a.acquire();
  // New process / restart: a fresh limiter pointed at the same file must not lose the count.
  const b = new EtsyRateLimiter({ dailyLimit: 100, minIntervalMs: 0, counterFilePath: path });
  assert.equal(b.used, 3);
  assert.equal(b.remaining, 97);
});

test("rolls over to a fresh budget on a new UTC day", async () => {
  const path = tmpCounter();
  writeFileSync(path, JSON.stringify({ date: "2000-01-01", used: 9999 }), "utf8");
  const rl = new EtsyRateLimiter({ dailyLimit: 10_000, minIntervalMs: 0, counterFilePath: path });
  assert.equal(rl.used, 0);
  assert.equal(rl.remaining, 10_000);
  // The stale file should have been rewritten with today's date.
  const persisted = JSON.parse(readFileSync(path, "utf8")) as { date: string };
  assert.equal(persisted.date, utcToday());
});

test("enforces a minimum interval between requests (burst limiter)", async () => {
  const rl = new EtsyRateLimiter({ dailyLimit: 100, minIntervalMs: 60, counterFilePath: tmpCounter() });
  const start = Date.now();
  await rl.acquire();
  await rl.acquire();
  await rl.acquire();
  const elapsed = Date.now() - start;
  // Two gaps of >=60ms each between three acquires.
  assert.ok(elapsed >= 110, `expected >=110ms of spacing, got ${elapsed}ms`);
});
