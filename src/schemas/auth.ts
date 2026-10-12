import { z } from "zod";
import { personNameSchema } from "./common";

export const otpIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number or email")
  .transform((v) => (v.includes("@") ? v.toLowerCase() : v.replace(/[\s-]/g, "")))
  .refine(
    (v) => z.email().safeParse(v).success || /^(\+91)?[6-9]\d{9}$/.test(v),
    "Enter a valid 10-digit mobile number or email",
  );

export const otpRequestSchema = z.object({
  identifier: otpIdentifierSchema,
  name: personNameSchema.optional(),
});

export const otpVerifySchema = z.object({
  requestId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const updateProfileSchema = z.object({
  name: personNameSchema,
  email: z.email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")),
});

export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
