import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { GiftCardStatus } from "@showbuzz/schemas/types/gift-card";

export interface GiftCardTransaction {
  /** issue = complimentary card created by staff; cancel = staff cancelled the card (remaining balance zeroed). */
  type: "purchase" | "redeem" | "refund" | "issue" | "cancel";
  amountPaise: number;
  /** Absent for issue/cancel entries (no booking involved). */
  bookingId?: Types.ObjectId;
  /** Staff member behind an issue/cancel entry. */
  staffId?: Types.ObjectId;
  at: Date;
}

/**
 * A ShowBuzz e-gift card. The ledger is embedded: every balance change is one update that `$inc`s the balance and
 * `$push`es its transaction together, so balance and history can't drift and no transaction is needed for that.
 * Spending is a conditional update (`balancePaise >= amount`), so two orders can never spend the same balance.
 * `code` is stored readable (unique) so the buyer can see it again; it is 80 random bits, so it can't be guessed.
 */
export interface GiftCardAttrs {
  /** 16 characters, Crockford base32, stored without dashes. */
  code: string;
  designId: string;
  amountPaise: number;
  balancePaise: number;
  /** purchase = bought on showbuzz.com; complimentary = issued by staff (prompt 7), no buyer and no purchase. */
  source?: "purchase" | "complimentary";
  /** Purchased cards only. */
  purchaserUserId?: Types.ObjectId;
  purchaseBookingId?: Types.ObjectId;
  /** Complimentary cards: who issued it and why. */
  issuedByStaffId?: Types.ObjectId;
  issueReason?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  recipientName: string;
  /** Email or mobile number, as entered when buying (no delivery provider yet). */
  recipientContact: string;
  message?: string;
  /** "expired" is also implied by `expiresAt`; reads treat a past expiry as expired whatever this says. */
  status: GiftCardStatus;
  expiresAt: Date;
  transactions: GiftCardTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema(
  {
    type: { type: String, enum: ["purchase", "redeem", "refund", "issue", "cancel"], required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    staffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const giftCardSchema = new Schema<GiftCardAttrs>(
  {
    code: { type: String, required: true, match: /^[0-9A-HJKMNP-TV-Z]{16}$/ },
    designId: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    balancePaise: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ["purchase", "complimentary"] },
    purchaserUserId: { type: Schema.Types.ObjectId, ref: "User" },
    purchaseBookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    issuedByStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    issueReason: { type: String, trim: true, maxlength: 300 },
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },
    recipientName: { type: String, required: true, trim: true, maxlength: 80 },
    recipientContact: { type: String, required: true, trim: true, maxlength: 254 },
    message: { type: String, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["active", "redeemed", "expired", "cancelled"],
      required: true,
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    transactions: { type: [transactionSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

giftCardSchema.index({ code: 1 }, { unique: true });
// Partial: complimentary cards have no purchase booking.
giftCardSchema.index(
  { purchaseBookingId: 1 },
  { unique: true, partialFilterExpression: { purchaseBookingId: { $exists: true } } },
);
giftCardSchema.index({ createdAt: -1 });
giftCardSchema.index({ purchaserUserId: 1, createdAt: -1 });

export const GiftCard: Model<GiftCardAttrs> =
  (models.GiftCard as Model<GiftCardAttrs> | undefined) ??
  model<GiftCardAttrs>("GiftCard", giftCardSchema, "giftCards");
