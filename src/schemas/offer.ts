import { z } from "zod";
import { idSchema, isoDateTimeSchema, paiseSchema } from "./common";

export const offerIconSchema = z.enum(["tags", "credit-card", "smartphone", "popcorn", "crown"]);

export const couponSchema = z.object({
  id: idSchema,
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
  validUntil: isoDateTimeSchema,
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
export type OfferIcon = z.infer<typeof offerIconSchema>;
