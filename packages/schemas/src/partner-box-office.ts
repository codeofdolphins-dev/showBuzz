import { z } from "zod";
import { bookingCodeSchema, counterPaymentMethodSchema, seatIdSchema } from "./booking";
import { idSchema, imageUrlSchema, isoDateTimeSchema, objectIdSchema, paiseSchema, toE164IndianPhone } from "./common";
import { foodCategorySchema } from "./food";
import { couponCodeSchema } from "./offer";
import { cancellationPolicySchema } from "./vendor";

/**
 * Partner portal box office: bookings, counter sales, gate check-in, food menu, the vendor's coupons and its
 * cancellation policy. The same schemas validate the forms and the Server Actions; the vendor always comes from the
 * session, never from these inputs.
 */

/** Seats or passes in one counter sale (a box-office sale can be bigger than an online order). */
export const COUNTER_MAX_TICKETS = 20;
/** Shortest reason accepted when a vendor cancels outside its own policy. */
export const OVERRIDE_REASON_MIN = 5;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

// -----------------------------------------------------------------------------------------------------------------
// Bookings

export const BOOKING_LIST_STATUSES = ["confirmed", "checked_in", "cancelled"] as const;
export const bookingListStatusSchema = z.enum(BOOKING_LIST_STATUSES);

export const vendorCancelBookingSchema = z.object({
  code: bookingCodeSchema,
  /** Required (checked by the service) when the booking is outside the policy: after the cutoff or not cancellable. */
  reason: z.string().trim().max(300).default(""),
  /** Refund in full (the vendor's own decision, e.g. a cancelled screening). */
  waiveFee: z.boolean().default(false),
});

// -----------------------------------------------------------------------------------------------------------------
// Counter sale (POS)

/** Optional walk-in mobile: empty, or a valid Indian mobile normalised to +91XXXXXXXXXX. */
const walkInPhoneSchema = z
  .string()
  .trim()
  .default("")
  .transform((v, ctx) => {
    if (!v) return undefined;
    const phone = toE164IndianPhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return phone;
  });

export const counterSaleSchema = z.object({
  tickets: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("seats"),
      showId: objectIdSchema,
      seatIds: z
        .array(seatIdSchema)
        .min(1, "Select at least one seat")
        .max(COUNTER_MAX_TICKETS, `At most ${COUNTER_MAX_TICKETS} seats per counter sale`)
        .refine((ids) => new Set(ids).size === ids.length, "Duplicate seats selected"),
    }),
    z.object({
      kind: z.literal("passes"),
      eventId: objectIdSchema,
      tierId: idSchema,
      quantity: z.int().min(1).max(COUNTER_MAX_TICKETS),
    }),
  ]),
  customer: z.object({
    name: optionalText(80),
    phone: walkInPhoneSchema,
  }),
  paymentMethod: counterPaymentMethodSchema,
  /** UPI transaction reference, for the vendor's own reconciliation. */
  paymentReference: optionalText(60),
});

// -----------------------------------------------------------------------------------------------------------------
// Gate check-in

/** A scanned QR payload ("SBT1.…") or a booking code typed by hand ("SB-123456"). */
export const checkInSchema = z.object({ input: z.string().trim().min(1, "Scan a ticket or type its code").max(1024) });

// -----------------------------------------------------------------------------------------------------------------
// Food & beverages

export const foodItemInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the item name").max(80),
  category: foodCategorySchema,
  isVeg: z.boolean(),
  pricePaise: paiseSchema.min(100, "Enter a price of at least ₹1"),
  size: z.string().trim().max(40).default(""),
  image: imageUrlSchema,
  description: z.string().trim().max(200).default(""),
  /** Empty = every one of the vendor's cinemas. */
  venueIds: z.array(objectIdSchema).max(100).default([]),
  available: z.boolean(),
});

// -----------------------------------------------------------------------------------------------------------------
// Coupons

/** Offer card colours a vendor can pick (Tailwind gradient stops used by the public offer card). */
export const COUPON_GRADIENTS = [
  { value: "from-rose-500 to-pink-600", label: "Rose" },
  { value: "from-indigo-500 to-purple-600", label: "Indigo" },
  { value: "from-blue-500 to-cyan-500", label: "Ocean" },
  { value: "from-amber-500 to-orange-600", label: "Sunset" },
  { value: "from-emerald-500 to-teal-600", label: "Emerald" },
  { value: "from-slate-700 to-slate-900", label: "Midnight" },
] as const;

/** Optional whole number from a text input: "" → undefined. */
const optionalCount = z.int("Enter a whole number").positive("Must be at least 1").optional();

export const vendorCouponInputSchema = z
  .object({
    code: couponCodeSchema,
    title: z.string().trim().min(3, "Enter a short title").max(80),
    description: z.string().trim().min(5, "Describe the offer").max(240),
    kind: z.enum(["percent", "flat"]),
    /** Percent off (up to 2 decimals); percent coupons only. Stored as basis points. */
    percentOff: z.number().min(0.01, "Enter a percentage").max(100, "At most 100%").optional(),
    flatPaise: paiseSchema.optional(),
    maxDiscountPaise: paiseSchema.optional(),
    minOrderPaise: paiseSchema.default(0),
    appliesTo: z.enum(["tickets", "food"]),
    validFrom: isoDateTimeSchema,
    validUntil: isoDateTimeSchema,
    usageLimit: optionalCount,
    perCustomerLimit: optionalCount,
    venueIds: z.array(objectIdSchema).max(100).default([]),
    movieIds: z.array(objectIdSchema).max(200).default([]),
    eventIds: z.array(objectIdSchema).max(200).default([]),
    showOnOffersPage: z.boolean(),
    gradient: z.enum(COUPON_GRADIENTS.map((g) => g.value) as [string, ...string[]]),
    terms: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "percent" && v.percentOff === undefined) {
      ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Enter the percentage off" });
    }
    if (v.kind === "flat" && (v.flatPaise === undefined || v.flatPaise < 100)) {
      ctx.addIssue({ code: "custom", path: ["flatPaise"], message: "Enter an amount of at least ₹1" });
    }
    if (Date.parse(v.validUntil) <= Date.parse(v.validFrom)) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Must be after the start" });
    }
    if (v.usageLimit !== undefined && v.perCustomerLimit !== undefined && v.perCustomerLimit > v.usageLimit) {
      ctx.addIssue({ code: "custom", path: ["perCustomerLimit"], message: "Can't be more than the total limit" });
    }
  });

// -----------------------------------------------------------------------------------------------------------------
// Cancellation policy

export const CUTOFF_PRESETS = [
  { minutes: 20, label: "20 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 1440, label: "24 hours" },
] as const;

/** The vendor's own policy; the fee can't exceed ₹10,000 (a guard against typing paise as rupees). */
export const vendorPolicyInputSchema = cancellationPolicySchema.extend({
  feePaise: paiseSchema.max(1_000_000, "At most ₹10,000"),
});

// -----------------------------------------------------------------------------------------------------------------
// Earnings

export const EARNINGS_GROUPINGS = ["day", "week", "month"] as const;
export const earningsGroupingSchema = z.enum(EARNINGS_GROUPINGS);

export type VendorCancelBookingInput = z.input<typeof vendorCancelBookingSchema>;
export type CounterSaleInput = z.input<typeof counterSaleSchema>;
export type CounterSale = z.output<typeof counterSaleSchema>;
export type FoodItemInput = z.input<typeof foodItemInputSchema>;
export type FoodItemValues = z.output<typeof foodItemInputSchema>;
export type VendorCouponInput = z.input<typeof vendorCouponInputSchema>;
export type VendorCouponValues = z.output<typeof vendorCouponInputSchema>;
export type VendorPolicyInput = z.input<typeof vendorPolicyInputSchema>;
export type BookingListStatus = z.infer<typeof bookingListStatusSchema>;
export type EarningsGrouping = z.infer<typeof earningsGroupingSchema>;
