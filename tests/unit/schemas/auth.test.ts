import { describe, expect, it } from "vitest";
import { otpIdentifierSchema } from "@/schemas/auth";

describe("otpIdentifierSchema", () => {
  it("trims and lowercases email addresses", () => {
    expect(otpIdentifierSchema.parse("  Aarav.Roy@Example.COM ")).toBe("aarav.roy@example.com");
  });

  it("strips spaces and dashes from mobile numbers", () => {
    expect(otpIdentifierSchema.parse(" 98765 43210 ")).toBe("9876543210");
    expect(otpIdentifierSchema.parse("98765-43210")).toBe("9876543210");
  });

  it("accepts a +91 country code", () => {
    expect(otpIdentifierSchema.parse("+91 98765 43210")).toBe("+919876543210");
  });

  it.each([
    ["an empty value", "   "],
    ["a short number", "98765"],
    ["a number not starting 6-9", "5876543210"],
    ["a malformed email", "aarav@"],
  ])("rejects %s", (_label, value) => {
    expect(otpIdentifierSchema.safeParse(value).success).toBe(false);
  });
});
