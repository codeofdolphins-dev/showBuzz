import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, disconnect } from "@showbuzz/db/connect";
import { OtpChallenge } from "@showbuzz/db/models/OtpChallenge";

const challenge = {
  channel: "sms" as const,
  identifier: "+919876543210",
  purpose: "sign_in" as const,
  codeHash: "c".repeat(64),
  expiresAt: new Date(Date.now() + 5 * 60_000),
};

beforeAll(async () => {
  await connect();
  await OtpChallenge.init();
});

afterEach(async () => {
  await OtpChallenge.deleteMany({ identifier: challenge.identifier });
});

afterAll(async () => {
  await disconnect();
});

describe("OtpChallenge model", () => {
  it("expires challenges with a TTL index on expiresAt", async () => {
    const indexes = await OtpChallenge.collection.indexes();
    const ttl = indexes.find((i) => i.key.expiresAt === 1);

    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it("indexes the latest challenge per identifier and purpose", async () => {
    const indexes = await OtpChallenge.collection.indexes();

    expect(
      indexes.some((i) => JSON.stringify(i.key) === JSON.stringify({ identifier: 1, purpose: 1, createdAt: -1 })),
    ).toBe(true);
  });

  it("defaults attempts and maxAttempts and records createdAt", async () => {
    const doc = await OtpChallenge.create(challenge);

    expect(doc.attempts).toBe(0);
    expect(doc.maxAttempts).toBe(5);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.toObject()).not.toHaveProperty("updatedAt");
  });

  it("requires a user for a contact change", async () => {
    await expect(OtpChallenge.create({ ...challenge, purpose: "change_contact" })).rejects.toThrow(
      /user it belongs to/,
    );

    const ok = await OtpChallenge.create({ ...challenge, purpose: "change_contact", userId: new Types.ObjectId() });
    expect(ok.userId).toBeInstanceOf(Types.ObjectId);
  });

  it("never serialises the code hash", async () => {
    const doc = await OtpChallenge.create(challenge);

    expect(doc.toJSON()).not.toHaveProperty("codeHash");
    expect(JSON.stringify(doc)).not.toContain("c".repeat(64));
    expect(doc.codeHash).toBe("c".repeat(64));
  });
});
