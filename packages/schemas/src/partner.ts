import { z } from "zod";
import { AUTH } from "./constants";
import { makeEmailSchema, makeIndianPhoneSchema, objectIdSchema, personNameSchema } from "./common";
import { newPasswordSchema, staffEmailSchema } from "./staff";
import {
  bankAccountNumberSchema,
  gstinSchema,
  ifscSchema,
  kycDocumentKindSchema,
  panSchema,
  vendorAddressSchema,
  vendorBusinessTypeSchema,
  vendorContactSchema,
} from "./vendor";

/**
 * Partner portal (partner.showbuzz.com): vendor logins, self-service signup and the KYC onboarding steps. The same
 * schemas validate the forms (React Hook Form) and the Server Actions.
 */

/** Same shape and limits as the staff login. */
export const partnerLoginSchema = z.object({
  email: staffEmailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const businessNameSchema = z.string().trim().min(2, "Enter the business name").max(120);

const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\d{${AUTH.otpLength}}$`), `Enter the ${AUTH.otpLength}-digit code`);

/** The signup form. The password is confirmed on the client and again here. */
export const vendorSignupSchema = z
  .object({
    businessName: businessNameSchema,
    businessType: vendorBusinessTypeSchema,
    contactName: personNameSchema,
    email: makeEmailSchema("Enter a valid email address").pipe(z.string().max(254)),
    phone: makeIndianPhoneSchema("Enter a valid 10-digit Indian mobile number"),
    cityId: z.string().trim().min(1, "Choose a city").max(64),
    password: newPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, "Accept the partner terms to continue"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "The passwords don't match",
    path: ["confirmPassword"],
  });

/** Step 1 of signup: send a code to the mobile number. */
export const vendorSignupCodeSchema = z.object({
  phone: makeIndianPhoneSchema("Enter a valid 10-digit Indian mobile number"),
});

/** Step 2: the whole form plus the code that proves the mobile number. */
export const vendorSignupVerifySchema = z.object({
  form: vendorSignupSchema,
  challengeId: objectIdSchema,
  code: otpCodeSchema,
});

/** Onboarding step 1. */
export const onboardingBusinessSchema = z.object({
  businessName: businessNameSchema,
  businessType: vendorBusinessTypeSchema,
  contact: vendorContactSchema,
  address: vendorAddressSchema,
});

/** Onboarding step 2. A GSTIN embeds the holder's PAN (characters 3–12), so the two must agree. */
export const onboardingTaxSchema = z
  .object({ gstin: gstinSchema, pan: panSchema })
  .refine((v) => v.gstin.slice(2, 12) === v.pan, {
    message: "The PAN must match characters 3 to 12 of the GSTIN",
    path: ["pan"],
  });

/** Onboarding step 3. The account number is typed twice. */
export const onboardingBankSchema = z
  .object({
    holderName: z.string().trim().min(2, "Enter the account holder's name").max(120),
    accountNumber: bankAccountNumberSchema,
    confirmAccountNumber: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, "")),
    ifsc: ifscSchema,
  })
  .refine((v) => v.accountNumber === v.confirmAccountNumber, {
    message: "The account numbers don't match",
    path: ["confirmAccountNumber"],
  });

/** Onboarding step 4 (one upload at a time; the file itself travels in the FormData). */
export const onboardingDocumentKindSchema = kycDocumentKindSchema.exclude(["other"]);

/** What the browser may know about the signed-in vendor user. Never includes sessions or hashes. */
export const vendorUserSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(["owner"]),
  lastLoginAt: z.iso.datetime().optional(),
});

export type PartnerLoginInput = z.infer<typeof partnerLoginSchema>;
export type VendorSignupInput = z.input<typeof vendorSignupSchema>;
export type VendorSignup = z.infer<typeof vendorSignupSchema>;
export type OnboardingBusinessInput = z.input<typeof onboardingBusinessSchema>;
export type OnboardingTaxInput = z.input<typeof onboardingTaxSchema>;
export type OnboardingBankInput = z.input<typeof onboardingBankSchema>;
export type OnboardingDocumentKind = z.infer<typeof onboardingDocumentKindSchema>;
export type VendorUserSnapshot = z.infer<typeof vendorUserSnapshotSchema>;
