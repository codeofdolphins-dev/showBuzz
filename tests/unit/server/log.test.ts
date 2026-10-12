import { afterEach, describe, expect, it, vi } from "vitest";
import { log, redact } from "@/server/log";

afterEach(() => {
  vi.restoreAllMocks();
});

function captureInfo(fields: Record<string, unknown>, msg = "test") {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  log.info(msg, fields);
  return JSON.parse(String(spy.mock.calls[0]?.[0]));
}

describe("log", () => {
  it("writes one JSON line with level, message and fields", () => {
    const entry = captureInfo({ requestId: "req-1", count: 3 }, "Seat held");
    expect(entry).toMatchObject({ level: "info", msg: "Seat held", requestId: "req-1", count: 3 });
    expect(typeof entry.ts).toBe("string");
  });

  it("redacts secrets at any depth", () => {
    const entry = captureInfo({
      password: "hunter2",
      passwordHash: "$2b$12$abc",
      otp: "123456",
      accessToken: "eyJ...",
      refresh_token: "r1",
      clientSecret: "s1",
      headers: { authorization: "Bearer abc", cookie: "sb_at=1", "set-cookie": "sb_rt=2", "x-api-key": "k" },
    });
    expect(entry).toMatchObject({
      password: "[REDACTED]",
      passwordHash: "[REDACTED]",
      otp: "[REDACTED]",
      accessToken: "[REDACTED]",
      refresh_token: "[REDACTED]",
      clientSecret: "[REDACTED]",
      headers: {
        authorization: "[REDACTED]",
        cookie: "[REDACTED]",
        "set-cookie": "[REDACTED]",
        "x-api-key": "[REDACTED]",
      },
    });
  });

  it("hides numeric codes (OTPs) but keeps error codes", () => {
    const entry = captureInfo({ code: "482913", error: { code: "RATE_LIMITED" }, mongo: { code: 11000 } });
    expect(entry).toMatchObject({ code: "[REDACTED]", error: { code: "RATE_LIMITED" }, mongo: { code: 11000 } });
  });

  it("matches whole words only", () => {
    expect(captureInfo({ footprint: "keep me" })).toMatchObject({ footprint: "keep me" });
  });

  it("masks email and phone fields and contact details inside text", () => {
    const entry = captureInfo(
      { email: "aarav.roy@example.com", phone: "+91 98765 43210", user: { identifier: "9876543210" } },
      "OTP requested by aarav.roy@example.com from 9876543210",
    );
    expect(entry).toMatchObject({
      msg: "OTP requested by a***@example.com from ******3210",
      email: "a***@example.com",
      phone: "********3210",
      user: { identifier: "******3210" },
    });
  });

  it("serialises errors with their message, code and stack, masked", () => {
    const err = Object.assign(new Error("No user for aarav@example.com"), { code: "NOT_FOUND" });
    const out = redact({ err }) as { err: Record<string, unknown> };
    expect(out.err).toMatchObject({ name: "Error", message: "No user for a***@example.com", code: "NOT_FOUND" });
    expect(typeof out.err.stack).toBe("string");
  });

  it("survives circular references", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop.self = loop;
    expect(redact(loop)).toEqual({ name: "loop", self: "[Circular]" });
  });
});
