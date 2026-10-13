import { afterEach, describe, expect, it, vi } from "vitest";

const message = { channel: "sms" as const, to: "+919876543210", code: "482913", purpose: "sign_in" as const };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

async function loadInProduction(provider?: string) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://showbuzz.example");
  if (provider) vi.stubEnv("OTP_PROVIDER", provider);
  vi.resetModules();
  return import("@showbuzz/core/auth/otp-delivery");
}

describe("OTP delivery outside production", () => {
  it("shows the code on screen with the dev provider and logs nothing", async () => {
    vi.stubEnv("OTP_PROVIDER", "dev");
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getOtpSender } = await import("@showbuzz/core/auth/otp-delivery");

    expect(await getOtpSender().send(message)).toEqual({ devCode: "482913" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs the code and shows it on screen with the default (none) provider", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getOtpSender } = await import("@showbuzz/core/auth/otp-delivery");

    expect(await getOtpSender().send(message)).toEqual({ devCode: "482913" });
    expect(String(warn.mock.calls[0]?.[0])).toContain("482913");
  });
});

describe("OTP delivery in production", () => {
  it("never returns devCode, and logs the code while no provider is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getOtpSender, LogOtpSender } = await loadInProduction();

    const sender = getOtpSender();
    expect(sender).toBeInstanceOf(LogOtpSender);
    expect(await sender.send(message)).toEqual({});
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("482913");
    expect(line).not.toContain("9876543210");
  });

  it("rejects OTP_PROVIDER=dev at startup", async () => {
    await expect(loadInProduction("dev")).rejects.toThrow(/OTP_PROVIDER/);
  });

  it("never returns devCode from the dev sender either", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { DevOtpSender } = await loadInProduction();

    expect(await new DevOtpSender().send(message)).toEqual({});
  });
});

describe("customer auth env", () => {
  it("requires OTP_HASH_SECRET of at least 32 characters", async () => {
    vi.stubEnv("OTP_HASH_SECRET", "too-short");
    vi.resetModules();

    await expect(import("@showbuzz/runtime/customer-auth-env")).rejects.toThrow(/OTP_HASH_SECRET: must be at least 32 characters/);
  });
});
