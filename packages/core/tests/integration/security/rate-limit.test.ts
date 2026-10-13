import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, disconnect } from "@showbuzz/db/connect";
import { RateLimit } from "@showbuzz/db/models/RateLimit";
import { consumeRateLimit } from "@showbuzz/core/security/rate-limit";

const testStart = new Date();

beforeAll(async () => {
  await connect();
  // Production builds these with `npm run db:sync-indexes`; the unique index is what keeps
  // concurrent first hits on one counter, so wait for it like a deployed database would have it.
  await RateLimit.init();
});

afterAll(async () => {
  await RateLimit.deleteMany({ expiresAt: { $gte: testStart } });
  await disconnect();
});

describe("consumeRateLimit", () => {
  it("allows exactly `limit` hits out of 20 concurrent calls", async () => {
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimit("otp:ip:203.0.113.7", { limit: 5, windowSec: 60, now })),
    );

    const allowed = results.filter((r) => r.allowed);
    const denied = results.filter((r) => !r.allowed);
    expect(allowed).toHaveLength(5);
    expect(allowed.map((r) => r.remaining).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(allowed.every((r) => r.retryAfterSec === 0)).toBe(true);
    expect(denied).toHaveLength(15);
    for (const r of denied) {
      expect(r.remaining).toBe(0);
      expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
      expect(r.retryAfterSec).toBeLessThanOrEqual(60);
    }
  });

  it("reports the seconds left in the current window", async () => {
    // 10 seconds into a 60-second window.
    const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
    const now = new Date(windowStart + 10_000);
    await consumeRateLimit("window-test", { limit: 1, windowSec: 60, now });

    expect(await consumeRateLimit("window-test", { limit: 1, windowSec: 60, now })).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSec: 50,
    });
  });

  it("starts a fresh count in the next window", async () => {
    const now = new Date();
    const next = new Date(now.getTime() + 60_000);
    await consumeRateLimit("reset-test", { limit: 1, windowSec: 60, now });
    expect((await consumeRateLimit("reset-test", { limit: 1, windowSec: 60, now })).allowed).toBe(false);

    expect((await consumeRateLimit("reset-test", { limit: 1, windowSec: 60, now: next })).allowed).toBe(true);
  });

  it("keeps keys independent", async () => {
    const now = new Date();
    await consumeRateLimit("key-a", { limit: 1, windowSec: 60, now });

    expect((await consumeRateLimit("key-b", { limit: 1, windowSec: 60, now })).allowed).toBe(true);
  });

  it("stores a hash instead of the raw key", async () => {
    await consumeRateLimit("otp:phone:+919876543210", { limit: 3, windowSec: 60 });

    expect(await RateLimit.countDocuments({ key: { $regex: "9876543210" } })).toBe(0);
    expect(await RateLimit.countDocuments({ key: { $regex: "^[0-9a-f]{64}$" } })).toBeGreaterThan(0);
  });
});
