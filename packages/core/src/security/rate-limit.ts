import "server-only";
import { createHash } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { RateLimit } from "@showbuzz/db/models/RateLimit";

export interface RateLimitOptions {
  /** Hits allowed per window. */
  limit: number;
  windowSec: number;
  /** Clock override for tests. */
  now?: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets; 0 when the hit was allowed. */
  retryAfterSec: number;
}

/**
 * Fixed-window rate limiter. Counts one hit for `key` and reports whether it is within `limit`.
 * The signature has no storage types so the Mongo backing can be swapped for Redis later.
 */
export async function consumeRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const { limit, windowSec } = options;
  const now = (options.now ?? new Date()).getTime();
  const windowMs = windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;

  const count = await incrementWindow(hashKey(key), new Date(windowStart), new Date(windowEnd));
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((windowEnd - now) / 1000)),
  };
}

// Keys often contain phone numbers or emails; store a hash so the collection holds no contact details.
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Atomic increment: a single upsert, never read-then-write. */
async function incrementWindow(key: string, windowStart: Date, expiresAt: Date, isRetry = false): Promise<number> {
  await connect();
  try {
    const doc = await RateLimit.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after", lean: true },
    );
    if (!doc) throw new Error("Rate limit upsert returned no document");
    return doc.count;
  } catch (err) {
    // Two first hits can race to insert the same window; MongoDB usually retries this itself,
    // and one retry here covers the rest (the second attempt finds the inserted document).
    if (!isRetry && isDuplicateKeyError(err)) return incrementWindow(key, windowStart, expiresAt, true);
    throw err;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}
