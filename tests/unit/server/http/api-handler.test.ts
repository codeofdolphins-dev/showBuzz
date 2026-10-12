import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiHandler } from "@/server/http/api-handler";
import { AppError } from "@/server/http/app-error";
import { ok } from "@/server/http/responses";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/v1/things", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiHandler", () => {
  it("passes parsed body, query and params to the handler", async () => {
    const route = apiHandler(
      {
        body: z.object({ name: z.string() }),
        query: z.object({ tag: z.array(z.string()), page: z.coerce.number() }),
        params: z.object({ id: z.string() }),
      },
      ({ body, query, params }) => ok({ body, query, params }),
    );
    const request = new Request("http://localhost:3000/api/v1/things/42?tag=a&tag=b&page=2", {
      method: "POST",
      body: JSON.stringify({ name: "Chrono" }),
    });

    const res = await route(request, { params: Promise.resolve({ id: "42" }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { body: { name: "Chrono" }, query: { tag: ["a", "b"], page: 2 }, params: { id: "42" } },
    });
  });

  it("returns 422 with field errors when the body fails validation", async () => {
    const route = apiHandler({ body: z.object({ name: z.string().min(2, "Name is too short") }) }, () => ok(null));

    const res = await route(post(JSON.stringify({ name: "a" })));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Name is too short",
        details: { fieldErrors: { name: ["Name is too short"] } },
      },
    });
  });

  it("returns 422 when the body is not valid JSON", async () => {
    const route = apiHandler({ body: z.object({ name: z.string() }) }, () => ok(null));

    const res = await route(post("{not json"));

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });

  it("uses an AppError's status, code and message", async () => {
    const route = apiHandler({}, () => {
      throw new AppError("CONFLICT", "That seat is already held.", 409);
    });

    const res = await route(post("{}"));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "That seat is already held." },
    });
  });

  it("sets Retry-After when the error carries retryAfterSec", async () => {
    const route = apiHandler({}, () => {
      throw new AppError("RATE_LIMITED", "Too many attempts.", 429, { retryAfterSec: 42.2 });
    });

    const res = await route(post("{}"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("43");
    expect((await res.json()).error.details).toEqual({ retryAfterSec: 42.2 });
  });

  it("returns a generic 500 without leaking the error message, and logs it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = apiHandler({}, () => {
      throw new Error("connection string mongodb://admin:hunter2@db leaked");
    });

    const res = await route(post("{}"));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      success: false,
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    });
    expect(text).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledOnce();
    const logged = JSON.parse(String(consoleError.mock.calls[0]?.[0]));
    expect(logged).toMatchObject({
      level: "error",
      msg: "Unhandled API error",
      requestId: res.headers.get("x-request-id"),
    });
  });

  it("generates an x-request-id, or keeps a well-formed incoming one", async () => {
    const route = apiHandler({}, () => ok(null));

    expect((await route(post("{}"))).headers.get("x-request-id")).toMatch(UUID);
    expect((await route(post("{}", { "x-request-id": "edge-req-123456" }))).headers.get("x-request-id")).toBe(
      "edge-req-123456",
    );
    expect((await route(post("{}", { "x-request-id": "bad id" }))).headers.get("x-request-id")).toMatch(UUID);
  });

  it("sends no-store by default, also on errors", async () => {
    const okRoute = apiHandler({}, () => ok(null, undefined, { headers: { "Cache-Control": "public, max-age=60" } }));
    const failingRoute = apiHandler({}, () => {
      throw new AppError("NOT_FOUND", "Not found.", 404);
    });

    expect((await okRoute(post("{}"))).headers.get("Cache-Control")).toBe("no-store");
    expect((await failingRoute(post("{}"))).headers.get("Cache-Control")).toBe("no-store");
  });

  it("sends the opted-in Cache-Control value", async () => {
    const route = apiHandler({ cacheControl: "public, s-maxage=300" }, () => ok(null));

    expect((await route(post("{}"))).headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });
});
