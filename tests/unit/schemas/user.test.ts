import { describe, expect, it } from "vitest";
import { customerSnapshotSchema, otpChallengeInputSchema } from "@/schemas/user";

const challenge = {
  channel: "sms" as const,
  identifier: "+919876543210",
  purpose: "sign_in" as const,
  codeHash: "a".repeat(64),
  expiresAt: new Date("2026-10-12T10:05:00Z"),
};

describe("otpChallengeInputSchema", () => {
  it("accepts a sign-in challenge and defaults maxAttempts", () => {
    expect(otpChallengeInputSchema.parse(challenge).maxAttempts).toBe(5);
  });

  it("requires the user for a contact change", () => {
    const result = otpChallengeInputSchema.safeParse({ ...challenge, purpose: "change_contact" });
    expect(result.error?.issues[0]?.path).toEqual(["userId"]);
  });

  it("rejects an identifier that doesn't match its channel", () => {
    expect(otpChallengeInputSchema.safeParse({ ...challenge, identifier: "9876543210" }).success).toBe(false);
    expect(otpChallengeInputSchema.safeParse({ ...challenge, channel: "email" }).success).toBe(false);
  });

  it("rejects a plain code where a hash is expected", () => {
    expect(otpChallengeInputSchema.safeParse({ ...challenge, codeHash: "123456" }).success).toBe(false);
  });
});

describe("customerSnapshotSchema", () => {
  it("strips anything beyond the public shape", () => {
    const parsed = customerSnapshotSchema.parse({
      id: "652f1c0e8b3f4a2d9c1e7b55",
      name: "Aarav Roy",
      phone: "+919876543210",
      joinedAt: "2026-10-12T10:00:00.000Z",
      sessions: [{ refreshTokenHash: "x" }],
    });
    expect(parsed).toEqual({
      id: "652f1c0e8b3f4a2d9c1e7b55",
      name: "Aarav Roy",
      phone: "+919876543210",
      joinedAt: "2026-10-12T10:00:00.000Z",
    });
  });
});
