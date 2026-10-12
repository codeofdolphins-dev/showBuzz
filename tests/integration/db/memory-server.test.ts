import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// mongodb-memory-server ships the driver; batch 0.2 moves this to the app's Mongoose connection.
describe("in-memory MongoDB", () => {
  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(process.env.MONGODB_URI ?? "");
  });

  afterAll(async () => {
    await client?.close();
  });

  it("answers a ping as a replica set", async () => {
    const admin = client.db().admin();
    expect(await admin.ping()).toMatchObject({ ok: 1 });
    expect((await admin.command({ hello: 1 })).setName).toBeTruthy();
  });

  it("commits a transaction", async () => {
    const db = client.db(process.env.MONGODB_DB);
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
