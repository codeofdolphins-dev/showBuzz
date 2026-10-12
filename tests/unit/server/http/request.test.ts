import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/http/app-error";
import { assertSameOrigin, getClientIp } from "@/server/http/request";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getClientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("supports IPv6", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("ignores values that aren't IPs and falls back to unknown", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("assertSameOrigin", () => {
  // NEXT_PUBLIC_APP_URL defaults to http://localhost:3000 outside production.
  function request(headers: Record<string, string>) {
    return new Request("http://localhost:3000/api/v1/leads", { method: "POST", headers });
  }

  function forbidden(fn: () => void) {
    try {
      fn();
    } catch (err) {
      return err instanceof AppError && err.code === "FORBIDDEN" && err.status === 403;
    }
    return false;
  }

  it("allows a request from the app's origin", () => {
    expect(() => assertSameOrigin(request({ origin: "http://localhost:3000" }))).not.toThrow();
  });

  it("falls back to Referer when Origin is missing", () => {
    expect(() => assertSameOrigin(request({ referer: "http://localhost:3000/contact?x=1" }))).not.toThrow();
  });

  it("rejects another origin with 403", () => {
    expect(forbidden(() => assertSameOrigin(request({ origin: "https://evil.example" })))).toBe(true);
  });

  it("rejects a lookalike origin on another port", () => {
    expect(forbidden(() => assertSameOrigin(request({ origin: "http://localhost:3001" })))).toBe(true);
  });

  it("rejects requests with neither Origin nor Referer, or an opaque origin", () => {
    expect(forbidden(() => assertSameOrigin(request({})))).toBe(true);
    expect(forbidden(() => assertSameOrigin(request({ origin: "null" })))).toBe(true);
  });

  it("accepts the Vercel deployment hostname on preview builds", async () => {
    vi.stubEnv("VERCEL_URL", "showbuzz-abc123.vercel.app");
    vi.resetModules();
    const fresh = await import("@/server/http/request");

    expect(() => fresh.assertSameOrigin(request({ origin: "https://showbuzz-abc123.vercel.app" }))).not.toThrow();
  });
});
