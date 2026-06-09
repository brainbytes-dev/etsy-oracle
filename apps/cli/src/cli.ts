#!/usr/bin/env node
/**
 * etsy-oracle CLI.
 *
 * v1/M0 surface:
 *   etsy-oracle listings [--limit N] [--keywords "..."] [--json]
 *       Prints N real live Etsy listings (title, listing_id, price, num_favorers,
 *       creation date) pulled from findAllListingsActive.
 *   etsy-oracle status
 *       Prints the local rate-limiter quota for today (no API call).
 *
 * ingest / estimate / niches land in later milestones (M1–M4).
 */

import { parseArgs } from "node:util";
import {
  createEtsyClient,
  EtsyRateLimiter,
  EtsyApiError,
  EtsyRateLimitExhaustedError,
} from "@etsy-oracle/etsy-client";

/** Load .env from the current working directory if present (Node built-in, zero deps). */
function loadEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file — rely on the ambient environment. Not an error.
  }
}

interface Money {
  amount: number;
  divisor: number;
  currency_code: string;
}

interface ActiveListing {
  listing_id: number;
  title: string;
  price?: Money;
  num_favorers?: number;
  original_creation_timestamp?: number;
  created_timestamp?: number;
}

function formatPrice(price: Money | undefined): string {
  if (!price || typeof price.amount !== "number" || !price.divisor) return "n/a";
  const value = price.amount / price.divisor;
  return `${value.toFixed(2)} ${price.currency_code}`;
}

function formatDate(ts: number | undefined): string {
  if (typeof ts !== "number") return "n/a";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

async function cmdListings(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      limit: { type: "string", short: "n", default: "10" },
      keywords: { type: "string", short: "k" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const limit = Math.min(Math.max(Number(values.limit) || 10, 1), 100);
  const etsy = createEtsyClient();

  const query: Record<string, unknown> = { limit };
  if (values.keywords) query["keywords"] = values.keywords;

  const { data, error, response } = await etsy.GET("/v3/application/listings/active", {
    params: { query: query as never },
  });

  if (error || !data) {
    throw new EtsyApiError(response?.status ?? 0, JSON.stringify(error ?? "no data"));
  }

  const results = (data as { count: number; results: ActiveListing[] }).results ?? [];

  if (values.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    printTable(results);
  }

  const rl = etsy.rateLimiter;
  process.stderr.write(
    `\n${results.length} live listings · API quota today: ${rl.used}/${rl.remaining + rl.used} used\n` +
      `Note: 'views' is intentionally omitted — Etsy Open API v3 does not expose per-listing views ` +
      `on listing search (only num_favorers). Sales are estimated downstream; never exact.\n`
  );
}

function printTable(rows: ActiveListing[]): void {
  if (rows.length === 0) {
    process.stdout.write("No listings returned.\n");
    return;
  }
  const header = ["listing_id", "price", "favorers", "created", "title"];
  process.stdout.write(header.join("\t") + "\n");
  for (const r of rows) {
    const created = formatDate(r.original_creation_timestamp ?? r.created_timestamp);
    const title = (r.title ?? "").replace(/\s+/g, " ").slice(0, 60);
    process.stdout.write(
      [String(r.listing_id), formatPrice(r.price), String(r.num_favorers ?? 0), created, title].join(
        "\t"
      ) + "\n"
    );
  }
}

function cmdStatus(): void {
  const rl = new EtsyRateLimiter();
  const limit = rl.remaining + rl.used;
  const hasKey = Boolean(process.env["ETSY_API_KEYSTRING"]);
  const hasSecret = Boolean(process.env["ETSY_SHARED_SECRET"]);
  const authReady = hasKey && hasSecret;
  process.stdout.write(
    [
      `etsy-oracle status`,
      `  API keystring configured: ${hasKey ? "yes" : "NO — set ETSY_API_KEYSTRING in .env"}`,
      `  Shared secret configured: ${hasSecret ? "yes" : "NO — set ETSY_SHARED_SECRET in .env"}`,
      `  Auth ready (x-api-key):   ${authReady ? "yes" : 'NO — v3 needs "<keystring>:<shared_secret>", both required'}`,
      `  Daily request budget:     ${limit}`,
      `  Used today (UTC):         ${rl.used}`,
      `  Remaining today:          ${rl.remaining}`,
    ].join("\n") + "\n"
  );
}

function usage(): void {
  process.stdout.write(
    [
      "etsy-oracle — free, open-source Etsy product research (estimates, not exact data)",
      "",
      "Usage:",
      "  etsy-oracle listings [--limit N] [--keywords \"...\"] [--json]",
      "  etsy-oracle status",
      "",
      "Setup: copy .env.example to .env and set ETSY_API_KEYSTRING and ETSY_SHARED_SECRET.",
      "  Both are required — v3 sends them as x-api-key: <keystring>:<shared_secret>.",
      "  Get them at https://www.etsy.com/developers/your-apps",
    ].join("\n") + "\n"
  );
}

async function main(): Promise<void> {
  loadEnv();
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "listings":
      await cmdListings(rest);
      break;
    case "status":
      cmdStatus();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      usage();
      process.exitCode = 2;
  }
}

main().catch((err: unknown) => {
  if (err instanceof EtsyRateLimitExhaustedError) {
    process.stderr.write(`Rate limit: ${err.message}\n`);
    process.exitCode = 75; // EX_TEMPFAIL
  } else if (err instanceof EtsyApiError) {
    process.stderr.write(`Etsy API error (HTTP ${err.status}): ${err.body.slice(0, 300)}\n`);
    process.exitCode = 1;
  } else if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`Error: ${String(err)}\n`);
    process.exitCode = 1;
  }
});
