import { afterAll, describe, expect, it } from "vitest";
import { connect, disconnect } from "@showbuzz/db/connect";

afterAll(async () => {
  await disconnect();
});

describe("connect", () => {
  it("reuses the cached connection on repeat calls", async () => {
    const first = await connect();
    const second = await connect();

    expect(second).toBe(first);
    expect(first.connection.readyState).toBe(1);
  });

  it("shares one connection attempt between concurrent callers", async () => {
    await disconnect();

    const results = await Promise.all([connect(), connect(), connect()]);

    expect(new Set(results).size).toBe(1);
    expect(results[0]?.connection.readyState).toBe(1);
  });

  it("disables command buffering and connects to the test database", async () => {
    const { connection } = await connect();

    expect(connection.get("bufferCommands")).toBe(false);
    expect(connection.name).toBe("showbuzz_test");
  });
});
