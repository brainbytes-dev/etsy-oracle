/**
 * Etsy Open API v3 client.
 *
 * Wraps openapi-fetch with:
 *   - x-api-key authentication (keystring)
 *   - EtsyRateLimiter (10k req/day budget + burst limiting)
 *   - Exponential-backoff retry on 429/5xx
 *
 * Usage:
 *   const etsy = createEtsyClient({ apiKey: process.env.ETSY_API_KEYSTRING });
 *   const res = await etsy.GET("/v3/application/listings/active", { params: { query: { limit: 100 } } });
 */

import createFetchClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/etsy.js";
import { EtsyRateLimiter, type RateLimiterOptions } from "./rate-limiter.js";
import { withRetry, EtsyApiError, type RetryOptions } from "./retry.js";

export interface EtsyClientOptions {
  apiKey?: string;
  rateLimiter?: EtsyRateLimiter;
  rateLimiterOptions?: RateLimiterOptions;
  retry?: RetryOptions;
  /** Override base URL for testing. Default: https://openapi.etsy.com */
  baseUrl?: string;
}

export type EtsyClient = ReturnType<typeof createEtsyClient>;

export function createEtsyClient(opts: EtsyClientOptions = {}): ReturnType<typeof createFetchClient<paths>> & {
  rateLimiter: EtsyRateLimiter;
} {
  const apiKey = opts.apiKey ?? process.env["ETSY_API_KEYSTRING"];
  if (!apiKey) {
    throw new Error(
      "ETSY_API_KEYSTRING is required. Set it in .env or pass apiKey to createEtsyClient()."
    );
  }

  const rateLimiter = opts.rateLimiter ?? new EtsyRateLimiter(opts.rateLimiterOptions);

  const retryOptions: RetryOptions = {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 30_000,
    onRetry: (attempt, delayMs, reason) => {
      console.warn(`[etsy-client] retry attempt=${attempt} reason=${reason} delay=${delayMs}ms`);
    },
    ...opts.retry,
  };

  const fetchClient = createFetchClient<paths>({
    baseUrl: opts.baseUrl ?? "https://openapi.etsy.com",
  });

  // Middleware: rate-limit acquire + x-api-key header injection.
  const authMiddleware: Middleware = {
    async onRequest({ request }) {
      await rateLimiter.acquire();
      request.headers.set("x-api-key", apiKey);
      return request;
    },

    async onResponse({ response }) {
      if (!response.ok) {
        const body = await response.text();
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
        throw new EtsyApiError(response.status, body, retryAfterMs);
      }
      return response;
    },
  };

  fetchClient.use(authMiddleware);

  // Wrap every method with the retry harness.
  const wrapped = new Proxy(fetchClient, {
    get(target, prop) {
      const original = Reflect.get(target, prop);
      if (prop === "GET" || prop === "POST" || prop === "PUT" || prop === "DELETE" || prop === "PATCH") {
        return (...args: unknown[]) => withRetry(() => (original as (...a: unknown[]) => Promise<unknown>).apply(target, args), retryOptions);
      }
      return original;
    },
  }) as ReturnType<typeof createFetchClient<paths>>;

  return Object.assign(wrapped, { rateLimiter });
}

function parseRetryAfter(header: string): number {
  const seconds = Number(header);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header).getTime();
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return 1_000;
}
