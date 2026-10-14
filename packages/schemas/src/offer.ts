import { z } from "zod";
import { idSchema, isoDateTimeSchema, objectIdSchema, paiseSchema } from "./common";

export const offerIconSchema = z.enum(["tags", "credit-card", "smartphone", "popcorn", "crown"]);

export const couponSchema = z.object({
  id: idSchema,
  /** Vendor coupons only (valid on that vendor's shows); absent = platform coupon, valid everywhere. */
  vendorId: objectIdSchema.optional(),
  code: z.string().regex(/^[A-Z0-9]{3,20}$/),
  title: z.string().min(1),
  category: z.string().min(1),
  kind: z.enum(["percent", "flat", "bogo"]),
  /** Basis points; only for `percent` coupons. */
  percentBps: z.int().min(1).max(10_000).optional(),
  flatPaise: paiseSchema.optional(),
  maxDiscountPaise: paiseSchema.optional(),
  /** Measured against the subtotal named by `appliesTo`. */
  minOrderPaise: paiseSchema,
  appliesTo: z.enum(["tickets", "food"]),
  eligibleFormats: z.array(z.string()).optional(),
  minTickets: z.int().positive().optional(),
  weekendOnly: z.boolean().optional(),
  bank: z.string().optional(),
  /** Usable from this moment (missing = straight away). */
  validFrom: isoDateTimeSchema.optional(),
  validUntil: isoDateTimeSchema,
  /** Inactive coupons are never accepted (missing = active). */
  status: z.enum(["active", "inactive"]).optional(),
  /** Total confirmed redemptions allowed (missing = unlimited), counted in `usedCount`. */
  usageLimit: z.int().positive().optional(),
  /** Confirmed redemptions allowed per customer account (missing = unlimited). */
  perCustomerLimit: z.int().positive().optional(),
  usedCount: z.int().nonnegative().optional(),
  /** Vendor coupons: only at these venues / films / listings of the vendor (missing = all of them). */
  venueIds: z.array(objectIdSchema).optional(),
  movieIds: z.array(objectIdSchema).optional(),
  eventIds: z.array(objectIdSchema).optional(),
  /** Vendor coupons: listed on /offers, labelled with the vendor. Platform coupons are always listed. */
  showOnOffersPage: z.boolean().optional(),
  description: z.string().min(1),
  icon: offerIconSchema,
  /** Tailwind gradient stops used by the offer card. */
  gradient: z.string(),
  terms: z.array(z.string()),
});

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,20}$/, "Enter a valid coupon code");

export type Coupon = z.infer<typeof couponSchema>;
/** A coupon on the public /offers page; vendor coupons carry the seller's business name. */
export type OfferListing = Coupon & { vendorName?: string };
export type OfferIcon = z.infer<typeof offerIconSchema>;
