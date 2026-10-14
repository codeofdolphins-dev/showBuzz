import { z } from "zod";
import { AUTH } from "./constants";
import { contactIdentifierSchema } from "./auth";
import { E164_INDIAN_PHONE, objectIdSchema, personNameSchema } from "./common";

export const userStatusSchema = z.enum(["active", "blocked", "deleted"]);
export const otpChannelSchema = z.enum(["sms", "email"]);
export const otpPurposeSchema = z.enum([
  "sign_in",
  "change_contact",
  "delete_account",
  "reauthenticate",
  // Partner signup: proves the mobile number before a vendor account exists (no user behind it).
  "vendor_signup",
]);

/** Purposes issued before any customer account is involved, so the challenge has no userId. */
export const OTP_PURPOSES_WITHOUT_USER: readonly OtpPurpose[] = ["sign_in", "vendor_signup"];

/** What the browser may know about the signed-in customer. Never includes sessions or hashes. */
export const customerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email().optional(),
  phone: z.string().regex(E164_INDIAN_PHONE).optional(),
  joinedAt: z.iso.datetime(),
});

/** A customer account created on first successful verification. */
export const newCustomerSchema = z.object({
  name: personNameSchema,
  contact: contactIdentifierSchema,
});

/** A new OTP challenge. The identifier is the normalised phone (E.164) or email it was sent to. */
export const otpChallengeInputSchema = z
  .object({
    channel: otpChannelSchema,
    identifier: z.string().min(1),
    purpose: otpPurposeSchema,
    userId: objectIdSchema.optional(),
    pendingName: personNameSchema.optional(),
    codeHash: z.string().regex(/^[0-9a-f]{64}$/, "Expected a hex HMAC-SHA256 digest"),
    maxAttempts: z.int().min(1).max(AUTH.otpMaxAttempts).default(AUTH.otpMaxAttempts),
    expiresAt: z.date(),
    ipPrefix: z.string().optional(),
  })
  .refine((c) => OTP_PURPOSES_WITHOUT_USER.includes(c.purpose) || c.userId !== undefined, {
    message: "A contact change challenge needs the user it belongs to",
    path: ["userId"],
  })
  .refine(
    (c) => (c.channel === "sms" ? E164_INDIAN_PHONE.test(c.identifier) : z.email().safeParse(c.identifier).success),
    {
      message: "Identifier doesn't match its channel",
      path: ["identifier"],
    },
  );

export type UserStatus = z.infer<typeof userStatusSchema>;
export type OtpChannel = z.infer<typeof otpChannelSchema>;
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;
export type CustomerSnapshot = z.infer<typeof customerSnapshotSchema>;
export type NewCustomerInput = z.input<typeof newCustomerSchema>;
export type OtpChallengeInput = z.input<typeof otpChallengeInputSchema>;
