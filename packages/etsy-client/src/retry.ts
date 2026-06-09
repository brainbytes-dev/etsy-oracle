/**
 * Exponential-backoff retry wrapper for Etsy API fetch calls.
 *
 * Retries on:
 *   - 429 Too Many Requests   — honours Retry-After header when present
 *   - 5xx Server Error        — exponential backoff with jitter
 *
 * Does NOT retry on 4xx client errors (except 429) — those are bugs in the caller.
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry — useful for logging. */
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const initialDelayMs = opts.initialDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 30_000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        throw err;
      }

      if (attempt === maxAttempts) break;

      const delay = computeDelay(err, attempt, initialDelayMs, maxDelayMs);
      opts.onRetry?.(attempt, delay, retryReason(err));
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof EtsyApiError) {
    return err.status === 429 || err.status >= 500;
  }
  // Network errors (ECONNRESET, ETIMEDOUT, etc.) are always retryable.
  return err instanceof TypeError; // fetch network errors
}

function computeDelay(
  err: unknown,
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number
): number {
  // Honour Retry-After from 429 responses.
  if (err instanceof EtsyApiError && err.status === 429 && err.retryAfterMs) {
    return Math.min(err.retryAfterMs, maxDelayMs);
  }

  // Exponential backoff with full jitter: delay = random(0, min(cap, base * 2^attempt))
  const base = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * base);
}

function retryReason(err: unknown): string {
  if (err instanceof EtsyApiError) return `HTTP ${err.status}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EtsyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly retryAfterMs?: number
  ) {
    super(`Etsy API error ${status}: ${body.slice(0, 200)}`);
    this.name = "EtsyApiError";
  }
}
