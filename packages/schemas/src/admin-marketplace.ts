import { z } from "zod";
import { makeIndianPhoneSchema, objectIdSchema, personNameSchema } from "./common";
import { businessNameSchema } from "./partner";
import { staffEmailSchema } from "./staff";
import { billingModelSchema, planSchema, vendorBusinessTypeSchema } from "./vendor";

/**
 * Super-admin marketplace screens (admin.showbuzz.com): vendors, plans, subscription invoices, payouts,
 * list-your-show requests and the movie merge. The same schemas validate the forms and the Server Actions.
 */

const optionalObjectId = z.union([objectIdSchema, z.literal("")]).optional();

/** A vendor created by the super-admin: the signup form without the password and mobile code. */
export const adminCreateVendorSchema = z.object({
  businessName: businessNameSchema,
  businessType: vendorBusinessTypeSchema,
  contactName: personNameSchema,
  /** Contact email and the owner's partner login. */
  email: staffEmailSchema,
  phone: makeIndianPhoneSchema("Enter a valid 10-digit Indian mobile number"),
  cityId: z.string().trim().min(1, "Choose a city").max(64),
  /** The list-your-show request this vendor comes from, if any. */
  leadId: optionalObjectId,
});

/** A percentage typed in the form (up to 2 decimals), stored as basis points. */
const percentField = (what: string, max = 100) =>
  z
    .number({ error: `Enter the ${what}` })
    .min(0, "Can't be negative")
    .max(max, `At most ${max}%`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most 2 decimals");

export const percentToBps = (percent: number) => Math.round(percent * 100);
export const bpsToPercent = (bps: number) => bps / 100;

/** Per-vendor commercial terms. Changes apply to new orders only (each booking froze its own split). */
export const vendorTermsSchema = z
  .object({
    billingModel: billingModelSchema,
    planId: optionalObjectId,
    commissionPercent: percentField("commission", 50),
    convenienceFeePercent: percentField("convenience fee", 30),
    gstPercent: percentField("GST", 28),
    shareCustomerContact: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.billingModel === "subscription" && !v.planId) {
      ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose the vendor's plan" });
    }
  });

export const suspendVendorSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300),
});

export const planInputSchema = planSchema;

/** "2026-10": an IST calendar month. */
export const billingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month");

/** A bank transfer reference (UTR) or receipt number. */
export const paymentReferenceSchema = z.object({
  reference: z.string().trim().min(3, "Enter the payment reference").max(60),
});

export const voidReasonSchema = z.object({
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300),
});

const dateKeySchema = z.iso.date({ error: "Choose a date" });

/** Payout period: bookings whose show date (purchase date for undated passes) falls in [fromDate, toDate], IST. */
export const settlementRangeSchema = z
  .object({ vendorId: objectIdSchema, fromDate: dateKeySchema, toDate: dateKeySchema })
  .refine((v) => v.toDate >= v.fromDate, { path: ["toDate"], message: "The end date is before the start date" });

export const leadStatusSchema = z.enum(["new", "in_progress", "closed"]);

export const leadNoteSchema = z.object({ text: z.string().trim().min(2, "Write a note").max(1000) });

export const movieMergeSchema = z
  .object({ sourceId: objectIdSchema, keepId: objectIdSchema })
  .refine((v) => v.sourceId !== v.keepId, { path: ["keepId"], message: "Choose a different film to keep" });

export type AdminCreateVendorInput = z.input<typeof adminCreateVendorSchema>;
export type VendorTermsInput = z.input<typeof vendorTermsSchema>;
export type VendorTerms = z.output<typeof vendorTermsSchema>;
export type PlanInput = z.input<typeof planInputSchema>;
export type SettlementRangeInput = z.input<typeof settlementRangeSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
