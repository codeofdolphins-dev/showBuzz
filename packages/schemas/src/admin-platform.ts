import { z } from "zod";
import { couponCodeSchema, offerIconSchema } from "./offer";
import { isoDateTimeSchema, makeEmailSchema, paiseSchema } from "./common";
import { GIFT_CARD_LIMITS, MAX_TICKETS_PER_ORDER } from "./constants";
import { COUPON_GRADIENTS } from "./partner-box-office";
import { movieInputSchema } from "./partner-listing";

/**
 * Super-admin platform operations (prompt 7): settings, customers, bookings oversight, review moderation,
 * platform coupons and gift cards. The same schemas validate the forms and the Server Actions.
 */

/** A percentage typed in the form (up to 2 decimals), stored as basis points. */
const percentField = (what: string, max: number) =>
  z
    .number({ error: `Enter the ${what}` })
    .min(0, "Can't be negative")
    .max(max, `At most ${max}%`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most 2 decimals");

const reasonSchema = z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300);

// ---------------------------------------------------------------------------------------------------------------
// Platform settings

/** Prototype settings.html, minus what doesn't belong in the database (gateway keys, theme, currency). */
export const settingsInputSchema = z.object({
  gstPercent: percentField("GST", 28),
  convenienceFeePercent: percentField("convenience fee", 30),
  commissionPercent: percentField("commission", 50),
  cancellationCutoffMinutes: z
    .number({ error: "Enter the cutoff in minutes" })
    .int("Whole minutes")
    .min(0)
    .max(7 * 24 * 60, "At most 7 days"),
  cancellationFeePaise: paiseSchema.max(1_000_000, "At most ₹10,000"),
  maxTicketsPerOrder: z
    .number({ error: "Enter a number" })
    .int()
    .min(1, "At least 1")
    .max(MAX_TICKETS_PER_ORDER, `At most ${MAX_TICKETS_PER_ORDER} (the checkout's hard limit)`),
  seatHoldMinutes: z.number({ error: "Enter the minutes" }).int().min(3, "At least 3").max(30, "At most 30"),
  supportEmail: makeEmailSchema("Enter a valid email address"),
  supportPhone: z.string().trim().min(3, "Enter the helpline").max(60),
  defaultCityId: z.string().trim().min(1, "Choose a city").max(64),
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Customers and bookings

export const customerStatusFilterSchema = z.enum(["active", "blocked", "deleted"]);
export const blockCustomerSchema = z.object({ reason: reasonSchema });

/** Staff cancellation: always with a reason (it may be outside the vendor's policy); the fee may be waived. */
export const adminCancelBookingSchema = z.object({
  reason: reasonSchema,
  waiveFee: z.boolean().default(false),
});
export type AdminCancelBookingInput = z.input<typeof adminCancelBookingSchema>;

export const adminBookingStatusSchema = z.enum([
  "confirmed",
  "checked_in",
  "cancelled",
  "pending_payment",
  "payment_failed",
  "expired",
]);
export const bookingTypeSchema = z.enum(["movie", "event", "gift_card"]);

// ---------------------------------------------------------------------------------------------------------------
// Reviews

export const reviewStatusSchema = z.enum(["published", "hidden"]);
export const moderateReviewSchema = z.object({ status: reviewStatusSchema });

// ---------------------------------------------------------------------------------------------------------------
// Platform coupons

/** Card colours for platform offers: the vendor palette plus the ones the seeded offers use. */
export const PLATFORM_COUPON_GRADIENTS = [
  ...COUPON_GRADIENTS,
  { value: "from-rose-500 to-pink-500", label: "Pink" },
  { value: "from-blue-600 to-indigo-600", label: "Royal" },
  { value: "from-amber-500 to-orange-500", label: "Amber" },
  { value: "from-purple-600 to-violet-700", label: "Violet" },
] as const;

export const OFFER_ICON_LABELS: Record<z.infer<typeof offerIconSchema>, string> = {
  tags: "Tag",
  "credit-card": "Card",
  smartphone: "UPI / phone",
  popcorn: "Popcorn",
  crown: "Crown",
};

const optionalCount = z.int("Enter a whole number").positive("Must be at least 1").optional();

export const platformCouponInputSchema = z
  .object({
    code: couponCodeSchema,
    title: z.string().trim().min(3, "Enter a short title").max(80),
    category: z.string().trim().min(2, "Enter a category (e.g. UPI, Credit Cards)").max(40),
    description: z.string().trim().min(5, "Describe the offer").max(240),
    kind: z.enum(["percent", "flat", "bogo"]),
    /** Percent off (up to 2 decimals); percent coupons only. Stored as basis points. */
    percentOff: z.number().min(0.01, "Enter a percentage").max(100, "At most 100%").optional(),
    flatPaise: paiseSchema.optional(),
    maxDiscountPaise: paiseSchema.optional(),
    minOrderPaise: paiseSchema.default(0),
    appliesTo: z.enum(["tickets", "food"]),
    eligibleFormats: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
    minTickets: optionalCount,
    weekendOnly: z.boolean().default(false),
    bank: z.string().trim().max(80).default(""),
    validFrom: isoDateTimeSchema.or(z.literal("")),
    validUntil: isoDateTimeSchema,
    usageLimit: optionalCount,
    perCustomerLimit: optionalCount,
    icon: offerIconSchema,
    gradient: z.enum(PLATFORM_COUPON_GRADIENTS.map((g) => g.value) as [string, ...string[]]),
    terms: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.kind === "percent" && v.percentOff === undefined) issue("percentOff", "Enter the percentage off");
    if (v.kind === "flat" && (v.flatPaise === undefined || v.flatPaise < 100)) {
      issue("flatPaise", "Enter an amount of at least ₹1");
    }
    if (v.kind === "bogo" && v.appliesTo !== "tickets") issue("appliesTo", "Buy-one-get-one applies to tickets");
    if (v.validFrom && Date.parse(v.validUntil) <= Date.parse(v.validFrom)) issue("validUntil", "Must be after the start");
    if (v.usageLimit !== undefined && v.perCustomerLimit !== undefined && v.perCustomerLimit > v.usageLimit) {
      issue("perCustomerLimit", "Can't be more than the total limit");
    }
  });
export type PlatformCouponInput = z.input<typeof platformCouponInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Gift cards

export const issueGiftCardSchema = z.object({
  amountPaise: paiseSchema
    .min(GIFT_CARD_LIMITS.minPaise, `At least ₹${GIFT_CARD_LIMITS.minPaise / 100}`)
    .max(GIFT_CARD_LIMITS.maxPaise, `At most ₹${(GIFT_CARD_LIMITS.maxPaise / 100).toLocaleString("en-IN")}`),
  designId: z.string().trim().min(1, "Choose a design").max(40),
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  /** Email or mobile number (no delivery provider yet: staff pass the code on). */
  recipientContact: z.string().trim().min(5, "Enter an email or mobile number").max(254),
  message: z.string().trim().max(200).default(""),
  /** Why the card is given (goodwill, contest prize, ...): kept on the card for audit. */
  reason: reasonSchema,
});
export type IssueGiftCardInput = z.input<typeof issueGiftCardSchema>;

export const cancelGiftCardSchema = z.object({ reason: reasonSchema });
export const giftCardStatusFilterSchema = z.enum(["active", "redeemed", "expired", "cancelled"]);
export const giftCardSourceSchema = z.enum(["purchase", "complimentary"]);

// ---------------------------------------------------------------------------------------------------------------
// Movies (super-admin film editor)

/**
 * Every field of a film: the vendor movie form plus the editorial fields only ShowBuzz sets (catalogue rating,
 * votes label, trending). The partner app parses with movieInputSchema, which drops the editorial keys.
 */
export const adminMovieInputSchema = movieInputSchema.extend({
  rating: z.number({ error: "Enter a rating from 0 to 10" }).min(0, "0 to 10").max(10, "0 to 10"),
  votesLabel: z.string().trim().max(30),
  isTrending: z.boolean(),
});
export type AdminMovieInput = z.input<typeof adminMovieInputSchema>;
