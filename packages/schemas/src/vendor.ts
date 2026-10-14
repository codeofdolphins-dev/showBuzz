import { z } from "zod";
import { makeEmailSchema, makeIndianPhoneSchema, objectIdSchema, paiseSchema, slugSchema } from "./common";

/**
 * Vendors: the businesses that sell on ShowBuzz (cinema chains, event organisers, venue operators). Every venue,
 * event, show and booking belongs to one vendor; movies are a shared catalogue. Percentages are basis points.
 */

export const vendorBusinessTypeSchema = z.enum(["cinema_chain", "event_organiser", "venue_operator", "other"]);
export const vendorOnboardingStatusSchema = z.enum(["incomplete", "complete"]);
export const vendorStatusSchema = z.enum(["active", "suspended"]);
export const billingModelSchema = z.enum(["subscription", "commission"]);
export const kycDocumentKindSchema = z.enum([
  "gst_certificate",
  "pan_card",
  "cancelled_cheque",
  // Certificate of incorporation / partnership deed / shop & establishment licence (optional: proprietors may have none).
  "business_registration",
  "other",
]);

/** Documents onboarding can't complete without (business registration is optional). */
export const REQUIRED_KYC_DOCUMENTS = ["gst_certificate", "pan_card", "cancelled_cheque"] as const;

export const KYC_DOCUMENT_LABELS: Record<z.infer<typeof kycDocumentKindSchema>, string> = {
  gst_certificate: "GST registration certificate",
  pan_card: "PAN card",
  cancelled_cheque: "Cancelled cheque",
  business_registration: "Business registration certificate",
  other: "Other document",
};

export const VENDOR_BUSINESS_TYPE_LABELS: Record<
  "cinema_chain" | "event_organiser" | "venue_operator" | "other",
  string
> = {
  cinema_chain: "Cinema / multiplex chain",
  event_organiser: "Event organiser",
  venue_operator: "Venue operator",
  other: "Other",
};

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN check digit (15th character) for the first 14 characters (GSTN's mod-36 scheme). */
export function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(first14.charAt(i)) * ((i % 2) + 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS.charAt((36 - (sum % 36)) % 36);
}

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;

const upper = z.string().trim().toUpperCase();

export const gstinSchema = upper
  .regex(GSTIN_PATTERN, "Enter a valid 15-character GSTIN")
  .refine((v) => gstinCheckDigit(v.slice(0, 14)) === v.charAt(14), "This GSTIN's check digit is wrong");
export const panSchema = upper.regex(PAN_PATTERN, "Enter a valid 10-character PAN");
export const ifscSchema = upper.regex(IFSC_PATTERN, "Enter a valid 11-character IFSC");
export const bankAccountNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(BANK_ACCOUNT_PATTERN, "Enter a 9 to 18 digit account number"));

export const bankAccountSchema = z.object({
  holderName: z.string().trim().min(2).max(120),
  accountNumber: bankAccountNumberSchema,
  ifsc: ifscSchema,
});

/** Reference to a stored file (FileStorage, packages/db/src/storage). */
export const kycDocumentSchema = z.object({
  fileId: objectIdSchema,
  kind: kycDocumentKindSchema,
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.int().positive(),
  uploadedAt: z.iso.datetime({ offset: true }),
});

export const vendorKycSchema = z.object({
  gstin: gstinSchema,
  pan: panSchema,
  bankAccount: bankAccountSchema,
  documents: z.array(kycDocumentSchema).max(20),
});

const bps = z.int().min(0).max(10_000);

export const vendorRatesSchema = z.object({
  /** Commission vendors only (0 for subscription vendors). */
  commissionBps: bps,
  convenienceFeeBps: bps,
  /** GST charged on the convenience fee. */
  gstBps: bps,
});

export const cancellationPolicySchema = z.object({
  allowed: z.boolean(),
  cutoffMinutes: z
    .int()
    .min(0)
    .max(7 * 24 * 60),
  feePaise: paiseSchema,
});

export const vendorAddressSchema = z.object({
  line: z.string().trim().min(3).max(300),
  cityId: z.string().trim().min(1).max(64),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
});

export const vendorContactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: makeEmailSchema("Enter a valid email address"),
  phone: makeIndianPhoneSchema("Enter a valid 10-digit Indian mobile number"),
});

export const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  monthlyFeePaise: paiseSchema,
  active: z.boolean(),
});

/** Only the last 4 digits ("XXXXXX1234"); the whole number is shown only on the KYC screens. */
export function maskAccountNumber(accountNumber: string): string {
  return `${"X".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

/** "Up to 20 mins before show" / "Up to 2 hours before show" for cancellation labels. */
export function describeCutoff(minutes: number): string {
  if (minutes === 0) return "until the show starts";
  if (minutes % 1440 === 0) return `up to ${minutes / 1440} ${minutes === 1440 ? "day" : "days"} before the show`;
  if (minutes % 60 === 0) return `up to ${minutes / 60} ${minutes === 60 ? "hour" : "hours"} before the show`;
  return `up to ${minutes} mins before the show`;
}

export const vendorSlugSchema = slugSchema;

export type VendorBusinessType = z.infer<typeof vendorBusinessTypeSchema>;
export type VendorOnboardingStatus = z.infer<typeof vendorOnboardingStatusSchema>;
export type VendorStatus = z.infer<typeof vendorStatusSchema>;
export type BillingModel = z.infer<typeof billingModelSchema>;
export type KycDocumentKind = z.infer<typeof kycDocumentKindSchema>;
export type KycDocument = z.infer<typeof kycDocumentSchema>;
export type BankAccount = z.infer<typeof bankAccountSchema>;
export type VendorKyc = z.infer<typeof vendorKycSchema>;
export type VendorRates = z.infer<typeof vendorRatesSchema>;
export type CancellationPolicy = z.infer<typeof cancellationPolicySchema>;
export type VendorAddress = z.infer<typeof vendorAddressSchema>;
export type VendorContact = z.infer<typeof vendorContactSchema>;
export type Plan = z.infer<typeof planSchema>;
