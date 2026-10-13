import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRequestContext } from "@showbuzz/core/auth/context";
import { verifyAccessToken } from "@showbuzz/core/auth/jwt";
import { createSession, revokeAllSessions, revokeSession, rotateSession } from "@showbuzz/core/auth/session";
import { connect, disconnect } from "@showbuzz/db/connect";
import { AppError } from "@showbuzz/core/http/app-error";
import { User, type UserDocument } from "@showbuzz/db/models/User";

const ctx = (now: Date): AuthRequestContext => ({ ip: "203.0.113.10", userAgent: "vitest", now });
const later = (from: Date, ms: number) => new Date(from.getTime() + ms);

async function failure(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("Expected an AppError");
}

async function sessionsOf(user: UserDocument) {
  return (await User.findById(user._id))?.sessions ?? [];
}

let user: UserDocument;

beforeAll(async () => {
  await connect();
  await User.init();
});

beforeEach(async () => {
  user = await User.create({ name: "Session Tester", phone: "+919876543210" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await User.deleteMany({});
});

afterAll(async () => {
  await disconnect();
});

describe("createSession", () => {
  it("issues a token pair and stores only hashes plus a coarse IP prefix", async () => {
    const now = new Date();
    const tokens = await createSession(user, ctx(now));

    const access = await verifyAccessToken(tokens.accessToken, now);
    expect(access.ok && access.claims).toMatchObject({ sub: user._id.toString(), sid: tokens.sid });

    const [stored] = await sessionsOf(user);
    expect(stored).toMatchObject({ sid: tokens.sid, userAgent: "vitest", ipPrefix: "203.0.113.0/24" });
    expect(stored?.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    const raw = JSON.stringify(await User.collection.findOne({ _id: user._id }));
    expect(raw).not.toContain(tokens.refreshToken);
    expect(raw).not.toContain(tokens.accessToken);
  });

  it("keeps at most 10 sessions, evicting the least recently used", async () => {
    const start = new Date();
    const sids: string[] = [];
    for (let i = 0; i < 11; i++) sids.push((await createSession(user, ctx(later(start, i * 1000)))).sid);

    const kept = (await sessionsOf(user)).map((s) => s.sid);
    expect(kept).toHaveLength(10);
    expect(kept).not.toContain(sids[0]);
    expect(kept).toContain(sids[10]);
  });

  it("drops expired sessions when adding a new one", async () => {
    const start = new Date();
    const old = await createSession(user, ctx(start));

    await createSession(user, ctx(later(start, 8 * 24 * 3600_000)));

    expect((await sessionsOf(user)).map((s) => s.sid)).not.toContain(old.sid);
  });
});

describe("rotateSession", () => {
  it("rotates the refresh token and remembers the previous one", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));
    const next = await rotateSession(first.refreshToken, ctx(later(now, 60_000)));

    expect(next.sid).toBe(first.sid);
    expect(next.refreshToken).not.toBe(first.refreshToken);
    const [stored] = await sessionsOf(user);
    expect(stored?.previousRefreshTokenHash).toBe(
      (await import("node:crypto")).createHash("sha256").update(first.refreshToken).digest("hex"),
    );
    expect(stored?.rotatedAt?.getTime()).toBe(later(now, 60_000).getTime());
  });

  it("answers the previous token within 10 s with the current pair, without revoking", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));
    const rotated = await rotateSession(first.refreshToken, ctx(later(now, 60_000)));

    const raced = await rotateSession(first.refreshToken, ctx(later(now, 65_000)));

    expect(raced.refreshToken).toBe(rotated.refreshToken);
    expect(raced.sid).toBe(first.sid);
    expect(await sessionsOf(user)).toHaveLength(1);
    // The current token still rotates normally afterwards.
    await expect(rotateSession(rotated.refreshToken, ctx(later(now, 66_000)))).resolves.toBeDefined();
  });

  it("revokes the session when the previous token comes back after 10 s", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));
    const rotated = await rotateSession(first.refreshToken, ctx(later(now, 60_000)));

    const err = await failure(() => rotateSession(first.refreshToken, ctx(later(now, 71_000))));
    expect(err).toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    expect(await sessionsOf(user)).toHaveLength(0);
    // The legitimate holder of the newer token is signed out too: the session is gone.
    await expect(rotateSession(rotated.refreshToken, ctx(later(now, 72_000)))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    const logged = String(vi.mocked(console.warn).mock.calls.at(-1)?.[0]);
    expect(logged).toContain("auth.refresh_reuse");
    expect(logged).not.toContain(first.refreshToken);
  });

  it("gives two concurrent rotations of the same token the same pair", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));

    const [a, b] = await Promise.all([
      rotateSession(first.refreshToken, ctx(later(now, 60_000))),
      rotateSession(first.refreshToken, ctx(later(now, 60_000))),
    ]);

    expect(a.refreshToken).toBe(b.refreshToken);
    const sessions = await sessionsOf(user);
    expect(sessions).toHaveLength(1);
    await expect(rotateSession(a.refreshToken, ctx(later(now, 61_000)))).resolves.toBeDefined();
  });

  it("rejects a blocked user", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));
    await User.updateOne({ _id: user._id }, { $set: { status: "blocked" } });

    const err = await failure(() => rotateSession(first.refreshToken, ctx(later(now, 1000))));
    expect(err).toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("rejects an expired refresh token", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));

    const err = await failure(() => rotateSession(first.refreshToken, ctx(later(now, 7 * 24 * 3600_000 + 60_000))));
    expect(err).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects an access token used as a refresh token", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));

    await expect(rotateSession(first.accessToken, ctx(now))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("extends the session by 7 days on each rotation (sliding expiry)", async () => {
    const now = new Date();
    const first = await createSession(user, ctx(now));
    const next = await rotateSession(first.refreshToken, ctx(later(now, 3 * 24 * 3600_000)));

    expect(next.refreshExpiresAt.getTime()).toBeGreaterThan(first.refreshExpiresAt.getTime());
    expect((await sessionsOf(user))[0]?.expiresAt.getTime()).toBe(next.refreshExpiresAt.getTime());
  });
});

describe("revoking", () => {
  it("revokes one session", async () => {
    const now = new Date();
    const a = await createSession(user, ctx(now));
    const b = await createSession(user, ctx(now));

    await revokeSession(user._id.toString(), a.sid);

    expect((await sessionsOf(user)).map((s) => s.sid)).toEqual([b.sid]);
    await expect(rotateSession(a.refreshToken, ctx(now))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("revokes all sessions except the current one", async () => {
    const now = new Date();
    const keep = await createSession(user, ctx(now));
    await createSession(user, ctx(now));
    await createSession(user, ctx(now));

    await revokeAllSessions(user._id.toString(), keep.sid);
    expect((await sessionsOf(user)).map((s) => s.sid)).toEqual([keep.sid]);

    await revokeAllSessions(user._id.toString());
    expect(await sessionsOf(user)).toHaveLength(0);
  });
});
