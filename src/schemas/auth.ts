import { z } from "zod";
import { AUTH } from "@/config/constants";
import { makeEmailSchema, makeIndianPhoneSchema, personNameSchema, toE164IndianPhone } from "./common";

const IDENTIFIER_INVALID = "Enter a valid 10-digit mobile number or email";
const identifierEmailSchema = makeEmailSchema(IDENTIFIER_INVALID);

/**
 * A sign-in identifier as typed ("98765 43210", " Aarav@Example.com ") parsed into the channel the
 * code is sent on, with the value normalised: phones to E.164, emails trimmed and lowercased.
 */
export const contactIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number or email")
  .transform((value, ctx) => {
    if (value.includes("@")) {
      const email = identifierEmailSchema.safeParse(value);
      if (email.success) return { channel: "email" as const, email: email.data };
    } else {
      const phone = toE164IndianPhone(value);
      if (phone) return { channel: "sms" as const, phone };
    }
    ctx.addIssue({ code: "custom", message: IDENTIFIER_INVALID });
    return z.NEVER;
  });

export const otpRequestSchema = z.object({
  identifier: contactIdentifierSchema,
  name: personNameSchema.optional(),
});

export const otpVerifySchema = z.object({
  requestId: z.uuid(),
  code: z.string().regex(new RegExp(`^\\d{${AUTH.otpLength}}$`), `Enter the ${AUTH.otpLength}-digit code`),
});

export const updateProfileSchema = z.object({
  name: personNameSchema,
  email: makeEmailSchema("Enter a valid email address"),
  phone: makeIndianPhoneSchema("Enter a valid 10-digit mobile number"),
});

export type ContactIdentifier = z.output<typeof contactIdentifierSchema>;
export type PhoneIdentifier = Extract<ContactIdentifier, { channel: "sms" }>;
export type EmailIdentifier = Extract<ContactIdentifier, { channel: "email" }>;
export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpRequest = z.output<typeof otpRequestSchema>;
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
