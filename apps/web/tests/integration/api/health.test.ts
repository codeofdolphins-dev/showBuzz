import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/health/route";
import { disconnect } from "@showbuzz/db/connect";

afterAll(async () => {
  await disconnect();
});

describe("GET /api/v1/health", () => {
  it("reports the database as up", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/health"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await res.json()).toEqual({ success: true, data: { status: "ok", db: "up" } });
  });
});
