import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { Coupon as CouponShape } from "@showbuzz/schemas/offer";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * A promo code applied at checkout. `code` is upper case and unique. `vendorId` null = platform coupon (valid on
 * every show, listed on /offers); a vendor coupon applies only to that vendor's shows.
 */
export interface CouponAttrs extends Omit<CouponShape, "id" | "validUntil" | "vendorId"> {
  vendorId: Types.ObjectId | null;
  validUntil: Date;
  sortOrder: number;
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
    validUntil: { type: Date, required: true },
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
    validUntil: doc.validUntil.toISOString(),
    description: doc.description,
    icon: doc.icon,
    gradient: doc.gradient,
    terms: [...doc.terms],
  });
}

export const Coupon: Model<CouponAttrs> =
  (models.Coupon as Model<CouponAttrs> | undefined) ?? model<CouponAttrs>("Coupon", couponSchema, "coupons");
