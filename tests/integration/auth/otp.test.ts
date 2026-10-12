import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRequestContext } from "@/server/auth/context";
import { requestOtp, verifyOtp } from "@/server/auth/otp";
import { connect, disconnect } from "@/server/db/connect";
import { AppError } from "@/server/http/app-error";
import { OtpChallenge } from "@/server/models/OtpChallenge";
import { RateLimit } from "@/server/models/RateLimit";
import { User } from "@/server/models/User";

const PHONE = "+919876543210";
const ctx = (now: Date, ip = "203.0.113.10"): AuthRequestContext => ({ ip, userAgent: "vitest", now });
const later = (from: Date, seconds: number) => new Date(from.getTime() + seconds * 1000);

/** Runs `fn` and returns the AppError it throws. */
async function failure(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("Expected an AppError");
}

/** Requests a code and returns it with the challenge id (devCode is returned outside production). */
async function sendCode(identifier: string, now: Date, name?: string) {
  const result = await requestOtp({ identifier, name }, ctx(now));
  if (!result.devCode) throw new Error("Expected a devCode outside production");
  return { challengeId: result.challengeId, code: result.devCode, result };
}

function wrongCode(code: string) {
  return code === "000000" ? "111111" : "000000";
}

beforeAll(async () => {
  await connect();
  await Promise.all([User.init(), OtpChallenge.init(), RateLimit.init()]);
});

beforeEach(() => {
  // The "none" provider writes each code to the log; keep test output quiet.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  // In-memory test database only (tests/integration/setup.ts refuses any other URI).
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({}), RateLimit.deleteMany({})]);
});

afterAll(async () => {
  await disconnect();
});

describe("requestOtp", () => {
  it("returns a masked destination, timings and the code outside production", async () => {
    const { result } = await sendCode("98765 43210", new Date());

    expect(result).toEqual({
      challengeId: expect.stringMatching(/^[0-9a-f]{24}$/),
      destination: "98******10",
      expiresInSec: 300,
      resendAfterSec: 30,
      devCode: expect.stringMatching(/^\d{6}$/),
    });
    expect((await sendCode("Aarav@Example.com", new Date())).result.destination).toBe("a***@example.com");
  });

  it("answers the same way whether or not an account exists", async () => {
    await User.create({ name: "Existing Customer", phone: PHONE });
    const now = new Date();

    const existing = await requestOtp({ identifier: PHONE }, ctx(now));
    const fresh = await requestOtp({ identifier: "+919876543211" }, ctx(now));

    expect(Object.keys(existing).sort()).toEqual(Object.keys(fresh).sort());
    expect(existing.destination).toMatch(/^\d{2}\*{6}\d{2}$/);
    expect(fresh.destination).toMatch(/^\d{2}\*{6}\d{2}$/);
  });

  it("stores an HMAC of the code, never the code or its plain hash", async () => {
    const { challengeId, code } = await sendCode(PHONE, new Date());
    const stored = await OtpChallenge.findById(challengeId);

    expect(stored?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.codeHash).not.toContain(code);
    expect(stored?.codeHash).not.toBe(createHash("sha256").update(code).digest("hex"));
  });

  it("writes the code to the server log with the destination masked (no provider yet)", async () => {
    const { code } = await sendCode(PHONE, new Date());
    const line = String(vi.mocked(console.warn).mock.calls.at(-1)?.[0]);

    expect(line).toContain(code);
    expect(line).not.toContain("9876543210");
  });

  it("enforces a 30-second cooldown per identifier with retryAfterSec", async () => {
    const windowStart = new Date(Math.floor(Date.now() / 30_000) * 30_000);
    await sendCode(PHONE, windowStart);

    const err = await failure(() => requestOtp({ identifier: PHONE }, ctx(later(windowStart, 5))));
    expect(err).toMatchObject({ code: "RATE_LIMITED", status: 429, details: { retryAfterSec: 25 } });
    expect(err.message).toMatch(/wait/i);
  });

  it("allows 5 codes per identifier per hour", async () => {
    const hourStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    for (let i = 0; i < 5; i++) await requestOtp({ identifier: PHONE }, ctx(later(hourStart, i * 31)));

    const err = await failure(() => requestOtp({ identifier: PHONE }, ctx(later(hourStart, 5 * 31))));
    expect(err).toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(err.details?.retryAfterSec).toBe(3600 - 5 * 31);
  });

  it("allows 20 codes per IP per hour across identifiers", async () => {
    const hourStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    for (let i = 0; i < 20; i++)
      await requestOtp({ identifier: `+9198765432${String(i).padStart(2, "0")}` }, ctx(hourStart));

    const err = await failure(() => requestOtp({ identifier: "+919000000000" }, ctx(hourStart)));
    expect(err).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSec: 3600 } });
  });

  it("makes the previous code stop working when a new one is requested", async () => {
    const now = new Date();
    const first = await sendCode(PHONE, now);
    const second = await sendCode(PHONE, later(now, 31));

    const err = await failure(() => verifyOtp(first, ctx(later(now, 32))));
    expect(err).toMatchObject({ code: "OTP_EXPIRED", status: 410 });
    await expect(verifyOtp(second, ctx(later(now, 32)))).resolves.toBeDefined();
  });
});

describe("verifyOtp", () => {
  it("creates the account on first sign-in and reuses it afterwards", async () => {
    const now = new Date();
    const first = await sendCode(PHONE, now, "Aarav Roy");
    const user = await verifyOtp(first, ctx(now));

    expect(user).toMatchObject({ name: "Aarav Roy", phone: PHONE, status: "active" });
    expect(user.phoneVerifiedAt).toEqual(now);
    expect(user.lastLoginAt).toEqual(now);

    const next = later(now, 31);
    const second = await sendCode(PHONE, next, "Someone Else");
    const again = await verifyOtp(second, ctx(next));

    expect(again._id.toString()).toBe(user._id.toString());
    expect(again.name).toBe("Aarav Roy");
    expect(again.lastLoginAt).toEqual(next);
    expect(await User.countDocuments()).toBe(1);
  });

  it("uses the default name and verifies email sign-ins", async () => {
    const now = new Date();
    const user = await verifyOtp(await sendCode("Aarav@Example.com", now), ctx(now));

    expect(user).toMatchObject({ name: "ShowBuzz Member", email: "aarav@example.com" });
    expect(user.emailVerifiedAt).toEqual(now);
    expect(user.phone).toBeUndefined();
  });

  it("counts down remaining attempts and rejects the 6th even with the right code", async () => {
    const now = new Date();
    const { challengeId, code } = await sendCode(PHONE, now);

    for (const remaining of [4, 3, 2, 1, 0]) {
      const err = await failure(() => verifyOtp({ challengeId, code: wrongCode(code) }, ctx(now)));
      expect(err).toMatchObject({ code: "OTP_INVALID", status: 401, details: { remainingAttempts: remaining } });
    }

    const err = await failure(() => verifyOtp({ challengeId, code }, ctx(now)));
    expect(err).toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects an expired code with 410", async () => {
    const now = new Date();
    const sent = await sendCode(PHONE, now);

    const err = await failure(() => verifyOtp(sent, ctx(later(now, 300))));
    expect(err).toMatchObject({ code: "OTP_EXPIRED", status: 410 });
  });

  it("rejects an unknown challenge with 410", async () => {
    const err = await failure(() =>
      verifyOtp({ challengeId: new Types.ObjectId().toString(), code: "123456" }, ctx(new Date())),
    );
    expect(err).toMatchObject({ code: "OTP_EXPIRED", status: 410 });
  });

  it("won't accept a code twice", async () => {
    const now = new Date();
    const sent = await sendCode(PHONE, now);
    await verifyOtp(sent, ctx(now));

    const err = await failure(() => verifyOtp(sent, ctx(now)));
    expect(err).toMatchObject({ code: "OTP_EXPIRED", status: 410 });
  });

  it("lets exactly one of two concurrent correct verifies win", async () => {
    const now = new Date();
    const sent = await sendCode(PHONE, now);

    const results = await Promise.allSettled([verifyOtp(sent, ctx(now)), verifyOtp(sent, ctx(now))]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({ code: "OTP_EXPIRED" });
    expect(await User.countDocuments()).toBe(1);
  });

  it("gives blocked accounts a generic message without signing them in", async () => {
    await User.create({ name: "Blocked Customer", phone: PHONE, status: "blocked" });
    const now = new Date();

    const err = await failure(async () => verifyOtp(await sendCode(PHONE, now), ctx(now)));
    expect(err).toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    expect(err.message).not.toMatch(/block/i);
    expect((await User.findOne({ phone: PHONE }))?.lastLoginAt).toBeUndefined();
  });

  it("limits verify attempts per IP across challenges", async () => {
    const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000);
    const guess = () => verifyOtp({ challengeId: new Types.ObjectId().toString(), code: "123456" }, ctx(windowStart));
    for (let i = 0; i < 30; i++) await expect(guess()).rejects.toMatchObject({ code: "OTP_EXPIRED" });

    await expect(guess()).rejects.toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSec: 600 } });
  });

  it("skips per-IP limits when the IP is unknown", async () => {
    const now = new Date();
    for (let i = 0; i < 21; i++) {
      await requestOtp({ identifier: `+9198765432${String(i).padStart(2, "0")}` }, ctx(now, "unknown"));
    }
    expect(await OtpChallenge.countDocuments()).toBe(21);
  });
});
