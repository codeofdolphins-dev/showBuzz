import { describe, expect, it } from "vitest";
import { requestOtp, verifyOtp } from "@/server/auth/otp";

const now = new Date("2026-10-12T10:00:00Z");

describe("in-memory OTP sign-in (until batch 1.2)", () => {
  it("normalises a phone and signs in with the code", async () => {
    const { requestId, destination, devCode } = await requestOtp(
      { identifier: "098765 43210", name: "Aarav Roy" },
      now,
    );
    expect(destination).toBe("+919876543210");
    expect(devCode).toMatch(/^\d{6}$/);

    const customer = await verifyOtp({ requestId, code: devCode }, now);
    expect(customer).toEqual({
      id: expect.any(String),
      name: "Aarav Roy",
      phone: "+919876543210",
      joinedAt: now.toISOString(),
    });
  });

  it("uses the default name and a lowercased email", async () => {
    const { requestId, devCode } = await requestOtp({ identifier: " Aarav@Example.com " }, now);

    expect(await verifyOtp({ requestId, code: devCode }, now)).toMatchObject({
      name: "ShowBuzz Member",
      email: "aarav@example.com",
    });
  });

  it("expires codes after 5 minutes", async () => {
    const { requestId, devCode } = await requestOtp({ identifier: "9876543210" }, now);
    const later = new Date(now.getTime() + 5 * 60_000 + 1);

    await expect(verifyOtp({ requestId, code: devCode }, later)).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });
});
