import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, disconnect } from "@showbuzz/db/connect";
import { User } from "@showbuzz/db/models/User";

const session = {
  sid: "0b5e2f0c-6c1a-4a9e-9f7b-2d3c4e5f6a7b",
  refreshTokenHash: "f".repeat(64),
  refreshJti: "jti-1",
  previousRefreshTokenHash: "e".repeat(64),
  createdAt: new Date(),
  lastUsedAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  ipPrefix: "203.0.113.0/24",
};

function duplicateKeyCode(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
}

beforeAll(async () => {
  await connect();
  // Production builds indexes with `npm run db:sync-indexes`; the unique rules are what's tested here.
  await User.init();
});

afterEach(async () => {
  await User.deleteMany({ name: { $regex: "^Test " } });
});

afterAll(async () => {
  await disconnect();
});

describe("User model", () => {
  it("rejects a second user with the same phone", async () => {
    await User.create({ name: "Test One", phone: "+919876543210" });

    const err = await User.create({ name: "Test Two", phone: "+919876543210" }).catch((e: unknown) => e);
    expect(duplicateKeyCode(err)).toBe(11000);
  });

  it("rejects a second user with the same email, whatever its case", async () => {
    await User.create({ name: "Test One", email: "aarav@example.com" });

    const err = await User.create({ name: "Test Two", email: "AARAV@example.com" }).catch((e: unknown) => e);
    expect(duplicateKeyCode(err)).toBe(11000);
  });

  it("lets many users exist without an email (or without a phone)", async () => {
    await User.create([
      { name: "Test One", phone: "+919876543210" },
      { name: "Test Two", phone: "+919876543211" },
      { name: "Test Three", email: "three@example.com" },
      { name: "Test Four", email: "four@example.com" },
    ]);

    expect(await User.countDocuments({ name: { $regex: "^Test " } })).toBe(4);
  });

  it("requires a phone or an email", async () => {
    await expect(User.create({ name: "Test Nobody" })).rejects.toThrow(/phone number or an email/);
  });

  it("rejects a phone that isn't E.164", async () => {
    await expect(User.create({ name: "Test One", phone: "9876543210" })).rejects.toThrow(/phone/);
  });

  it("defaults the name, status and sessions", async () => {
    const user = await User.create({ phone: "+919876543210" });

    expect(user.name).toBe("ShowBuzz Member");
    expect(user.status).toBe("active");
    expect(user.sessions).toEqual([]);
    await user.deleteOne();
  });

  it("never serialises sessions or hashes", async () => {
    const user = await User.create({ name: "Test One", phone: "+919876543210", sessions: [session] });

    for (const out of [user.toJSON(), user.toObject(), JSON.parse(JSON.stringify(user))]) {
      const text = JSON.stringify(out);
      expect(out).not.toHaveProperty("sessions");
      expect(out).not.toHaveProperty("_id");
      expect(out).not.toHaveProperty("__v");
      expect(text).not.toContain("Hash");
      expect(text).not.toContain("f".repeat(64));
      expect(out).toMatchObject({ id: user._id.toString(), name: "Test One", phone: "+919876543210" });
    }
    // The document itself still has them for the session service.
    expect(user.sessions[0]?.refreshTokenHash).toBe("f".repeat(64));
  });

  it("returns only the public snapshot", async () => {
    const user = await User.create({ name: "Test One", email: "aarav@example.com", sessions: [session] });

    expect(user.toCustomerSnapshot()).toEqual({
      id: user._id.toString(),
      name: "Test One",
      email: "aarav@example.com",
      joinedAt: user.createdAt.toISOString(),
    });
  });

  it("indexes session ids", async () => {
    const indexes = await User.collection.indexes();
    expect(indexes.some((i) => i.key["sessions.sid"] === 1 && !i.unique)).toBe(true);
  });
});
