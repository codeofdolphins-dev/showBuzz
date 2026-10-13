import { describe, expect, it, vi } from "vitest";

vi.mock("@showbuzz/db/connect", () => ({ pingDatabase: vi.fn(async () => "down") }));

const { GET } = await import("@/app/api/v1/health/route");

describe("GET /api/v1/health", () => {
  it("returns 503 with no internal details when the database is down", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/health"));

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true, data: { status: "degraded", db: "down" } });
  });
});
