import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mongoose from "mongoose";
import { connect, disconnect } from "@showbuzz/db/connect";

describe("in-memory MongoDB", () => {
  let db: NonNullable<mongoose.Connection["db"]>;
  let client: ReturnType<mongoose.Connection["getClient"]>;

  beforeAll(async () => {
    const { connection } = await connect();
    if (!connection.db) throw new Error("No database handle");
    db = connection.db;
    client = connection.getClient();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("answers a ping as a replica set", async () => {
    const admin = db.admin();
    expect(await admin.ping()).toMatchObject({ ok: 1 });
    expect((await admin.command({ hello: 1 })).setName).toBeTruthy();
  });

  it("uses the test database, never the one from .env files", () => {
    expect(db.databaseName).toBe("showbuzz_test");
  });

  it("commits a transaction", async () => {
    const items = db.collection<{ name: string }>("smoke");
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await items.insertOne({ name: "one" }, { session });
        await items.insertOne({ name: "two" }, { session });
      });
    } finally {
      await session.endSession();
    }
    expect(await items.countDocuments()).toBe(2);
    await items.drop();
  });
});
