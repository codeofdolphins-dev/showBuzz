import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { Coupon as CouponShape } from "@showbuzz/schemas/offer";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * A promo code applied at checkout. `code` is upper case and unique. `vendorId` null = platform coupon (valid on
 * every show, listed on /offers); a vendor coupon applies only to that vendor's shows, optionally only some of its
 * venues, films or listings, and is listed on /offers only when `showOnOffersPage` is on.
 *
 * Usage: `usedCount` counts confirmed bookings that used the code. The payment-confirm transaction increases it
 * with one conditional update (`usedCount < usageLimit`), so two checkouts at once can't exceed a limit; cancelling
 * such a booking gives the use back.
 */
export interface CouponAttrs extends Omit<
  CouponShape,
  "id" | "validFrom" | "validUntil" | "vendorId" | "venueIds" | "movieIds" | "eventIds"
> {
  vendorId: Types.ObjectId | null;
  validFrom?: Date;
  validUntil: Date;
  venueIds: Types.ObjectId[];
  movieIds: Types.ObjectId[];
  eventIds: Types.ObjectId[];
  usedCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<CouponAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    kind: { type: String, enum: ["percent", "flat", "bogo"], required: true },
    percentBps: Number,
    flatPaise: Number,
    maxDiscountPaise: Number,
    minOrderPaise: { type: Number, default: 0 },
    appliesTo: { type: String, enum: ["tickets", "food"], required: true },
    eligibleFormats: { type: [String], default: undefined },
    minTickets: Number,
    weekendOnly: Boolean,
    bank: String,
    validFrom: Date,
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"] },
    usageLimit: { type: Number, min: 1 },
    perCustomerLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    venueIds: { type: [Schema.Types.ObjectId], ref: "Venue", default: [] },
    movieIds: { type: [Schema.Types.ObjectId], ref: "Movie", default: [] },
    eventIds: { type: [Schema.Types.ObjectId], ref: "Event", default: [] },
    showOnOffersPage: Boolean,
    description: { type: String, required: true },
    icon: { type: String, enum: ["tags", "credit-card", "smartphone", "popcorn", "crown"], required: true },
    gradient: { type: String, default: "" },
    terms: { type: [String], default: [] },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ vendorId: 1, sortOrder: 1 });

/** Drops keys that Mongo returns as null/missing so the object matches the Zod shape. */
function defined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)) as T;
}

const idList = (list: Types.ObjectId[] | undefined) => (list && list.length > 0 ? list.map(String) : undefined);

export function toCoupon(doc: LeanDoc<CouponAttrs>): CouponShape {
  return defined({
    id: doc._id.toString(),
    vendorId: doc.vendorId?.toString(),
    code: doc.code,
    title: doc.title,
    category: doc.category,
    kind: doc.kind,
    percentBps: doc.percentBps,
    flatPaise: doc.flatPaise,
    maxDiscountPaise: doc.maxDiscountPaise,
    minOrderPaise: doc.minOrderPaise,
    appliesTo: doc.appliesTo,
    eligibleFormats: doc.eligibleFormats ? [...doc.eligibleFormats] : undefined,
    minTickets: doc.minTickets,
    weekendOnly: doc.weekendOnly,
    bank: doc.bank,
    validFrom: doc.validFrom?.toISOString(),
    validUntil: doc.validUntil.toISOString(),
    status: doc.status,
    usageLimit: doc.usageLimit,
    perCustomerLimit: doc.perCustomerLimit,
    usedCount: doc.usedCount ?? 0,
    venueIds: idList(doc.venueIds),
    movieIds: idList(doc.movieIds),
    eventIds: idList(doc.eventIds),
    showOnOffersPage: doc.showOnOffersPage,
    description: doc.description,
    icon: doc.icon,
    gradient: doc.gradient,
    terms: [...doc.terms],
  });
}

export const Coupon: Model<CouponAttrs> =
  (models.Coupon as Model<CouponAttrs> | undefined) ?? model<CouponAttrs>("Coupon", couponSchema, "coupons");
