import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "@showbuzz/schemas/account";
import { contactIdentifierSchema, otpRequestSchema, otpVerifySchema } from "@showbuzz/schemas/auth";
import { indianPhoneSchema, makeEmailSchema, makeIndianPhoneSchema, toE164IndianPhone } from "@showbuzz/schemas/common";
import { contactLeadSchema } from "@showbuzz/schemas/lead";

describe("toE164IndianPhone", () => {
  it.each([
    ["10 digits", "9876543210"],
    ["spaces", " 98765 43210 "],
    ["dashes", "98765-43210"],
    ["dots and brackets", "(98765).43210"],
    ["trunk 0", "09876543210"],
    ["+91", "+919876543210"],
    ["+91 with spaces", "+91 98765 43210"],
    ["91 without plus", "919876543210"],
    ["0091", "00919876543210"],
    ["+91 and a trunk 0", "+91 0 98765 43210"],
    ["91 and a trunk 0", "91-0-9876543210"],
  ])("normalises %s", (_label, input) => {
    expect(toE164IndianPhone(input)).toBe("+919876543210");
  });

  it.each([
    ["a number starting with 5", "5876543210"],
    ["9 digits", "987654321"],
    ["11 digits", "98765432101"],
    ["letters", "98765abcde"],
    ["another country code", "+449876543210"],
    ["two trunk zeros", "009876543210"],
    ["empty", ""],
  ])("rejects %s", (_label, input) => {
    expect(toE164IndianPhone(input)).toBeNull();
  });
});

describe("contactIdentifierSchema", () => {
  it("parses a phone into the sms channel in E.164", () => {
    expect(contactIdentifierSchema.parse(" 098765-43210 ")).toEqual({ channel: "sms", phone: "+919876543210" });
  });

  it("parses an email into the email channel, trimmed and lowercased", () => {
    expect(contactIdentifierSchema.parse("  Aarav.Roy@Example.COM ")).toEqual({
      channel: "email",
      email: "aarav.roy@example.com",
    });
  });

  it("asks for a value when empty", () => {
    expect(contactIdentifierSchema.safeParse("   ").error?.issues[0]?.message).toBe(
      "Enter your mobile number or email",
    );
  });

  it.each(["98765", "5876543210", "aarav@", "@example.com", "aarav roy@example.com"])(
    "rejects %s with the form's message",
    (value) => {
      expect(contactIdentifierSchema.safeParse(value).error?.issues[0]?.message).toBe(
        "Enter a valid 10-digit mobile number or email",
      );
    },
  );

  it("reports the identifier field in sign-in requests", () => {
    const result = otpRequestSchema.safeParse({ identifier: "123" });
    expect(result.error?.issues[0]?.path).toEqual(["identifier"]);
  });
});

describe("otpVerifySchema", () => {
  const challengeId = "652f1c0e8b3f4a2d9c1e7b55";

  it("accepts a 6-digit code", () => {
    expect(otpVerifySchema.safeParse({ challengeId, code: "012345" }).success).toBe(true);
  });

  it.each(["12345", "1234567", "12a456"])("rejects %s", (code) => {
    expect(otpVerifySchema.safeParse({ challengeId, code }).error?.issues[0]?.message).toBe("Enter the 6-digit code");
  });
});

describe("shared phone and email fields", () => {
  it("normalises email and phone fields with each form's own message", () => {
    expect(makeEmailSchema("Enter a valid email address").parse(" Aarav@Example.com ")).toBe("aarav@example.com");
    expect(makeIndianPhoneSchema("Enter a valid 10-digit mobile number").parse("098765 43210")).toBe("+919876543210");
    expect(makeEmailSchema("Enter a valid email address").safeParse("nope").error?.issues[0]?.message).toBe(
      "Enter a valid email address",
    );
    expect(
      makeIndianPhoneSchema("Enter a valid 10-digit mobile number").safeParse("123").error?.issues[0]?.message,
    ).toBe("Enter a valid 10-digit mobile number");
  });

  it("validates the profile name", () => {
    expect(updateProfileSchema.parse({ name: "  Aarav Roy " })).toEqual({ name: "Aarav Roy" });
    expect(updateProfileSchema.safeParse({ name: "A" }).error?.issues[0]?.message).toBe("Name is too short");
  });

  it("keeps the checkout and lead phone messages", () => {
    expect(indianPhoneSchema.safeParse("123").error?.issues[0]?.message).toBe(
      "Enter a valid 10-digit Indian mobile number",
    );
    expect(indianPhoneSchema.parse("+91 98765 43210")).toBe("+919876543210");
  });

  it("allows an empty optional contact-form phone and normalises a filled one", () => {
    const base = { name: "Aarav Roy", email: "a@example.com", bookingCode: "", topic: "Feedback or General Enquiry" };
    const message = "Please check my booking";
    expect(contactLeadSchema.parse({ ...base, phone: "", message }).phone).toBe("");
    expect(contactLeadSchema.parse({ ...base, phone: "98765 43210", message }).phone).toBe("+919876543210");
    expect(contactLeadSchema.safeParse({ ...base, phone: "123", message }).error?.issues[0]?.message).toBe(
      "Enter a valid mobile number",
    );
  });
});
