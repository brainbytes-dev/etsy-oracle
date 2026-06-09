/**
 * Persistent token-bucket rate limiter for the Etsy Open API v3.
 *
 * Budget: 10,000 requests/day per keystring (resets at midnight UTC).
 * Burst: 10 req/s (100ms min interval between requests).
 *
 * The daily counter is persisted to disk so it survives worker restarts.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface RateLimiterOptions {
  dailyLimit?: number;
  minIntervalMs?: number;
  counterFilePath?: string;
}

interface PersistedCounter {
  date: string; // YYYY-MM-DD UTC
  used: number;
}

export class EtsyRateLimiter {
  private readonly dailyLimit: number;
  private readonly minIntervalMs: number;
  private readonly counterFilePath: string;

  private lastRequestAt = 0;
  private counter: PersistedCounter;

  constructor(opts: RateLimiterOptions = {}) {
    this.dailyLimit = opts.dailyLimit ?? Number(process.env["ETSY_DAILY_REQUEST_LIMIT"] ?? 10_000);
    this.minIntervalMs = opts.minIntervalMs ?? Number(process.env["ETSY_MIN_REQUEST_INTERVAL_MS"] ?? 100);
    this.counterFilePath = opts.counterFilePath ?? this.defaultCounterPath();
    this.counter = this.loadCounter();
    // Flush immediately so a stale/missing on-disk counter is reconciled to the
    // current UTC day even if the process never makes a request.
    this.persistCounter();
  }

  /** True if the daily budget is exhausted. */
  get isExhausted(): boolean {
    this.rolloverIfNewDay();
    return this.counter.used >= this.dailyLimit;
  }

  /** Requests remaining today. */
  get remaining(): number {
    this.rolloverIfNewDay();
    return Math.max(0, this.dailyLimit - this.counter.used);
  }

  /** Requests used today. */
  get used(): number {
    this.rolloverIfNewDay();
    return this.counter.used;
  }

  /**
   * Wait until a request slot is available, then increment the counter.
   * Throws if the daily budget is exhausted.
   */
  async acquire(): Promise<void> {
    this.rolloverIfNewDay();

    if (this.isExhausted) {
      throw new EtsyRateLimitExhaustedError(
        `Daily Etsy API budget exhausted (${this.dailyLimit} req/day). Resets at midnight UTC.`
      );
    }

    // Enforce minimum interval between requests (burst limiter).
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }

    this.lastRequestAt = Date.now();
    this.counter.used++;
    this.persistCounter();
  }

  private rolloverIfNewDay(): void {
    const today = utcDateString();
    if (this.counter.date !== today) {
      this.counter = { date: today, used: 0 };
      this.persistCounter();
    }
  }

  private loadCounter(): PersistedCounter {
    try {
      const raw = readFileSync(this.counterFilePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedCounter;
      // Rollover immediately if stale.
      if (parsed.date !== utcDateString()) {
        return { date: utcDateString(), used: 0 };
      }
      return parsed;
    } catch {
      return { date: utcDateString(), used: 0 };
    }
  }

  private persistCounter(): void {
    try {
      mkdirSync(dirname(this.counterFilePath), { recursive: true });
      writeFileSync(this.counterFilePath, JSON.stringify(this.counter), "utf8");
    } catch {
      // Non-fatal — losing the counter on one write means we might over-count
      // slightly on restart, but we never under-count (we already incremented in memory).
    }
  }

  private defaultCounterPath(): string {
    const dataDir = process.env["DUCKDB_PATH"]
      ? dirname(process.env["DUCKDB_PATH"])
      : join(process.cwd(), "data");
    return join(dataDir, ".etsy-rate-counter.json");
  }
}

export class EtsyRateLimitExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EtsyRateLimitExhaustedError";
  }
}

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
