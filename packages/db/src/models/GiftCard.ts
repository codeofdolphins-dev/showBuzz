import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { GiftCardStatus } from "@showbuzz/schemas/types/gift-card";

export interface GiftCardTransaction {
  type: "purchase" | "redeem" | "refund";
  amountPaise: number;
  bookingId: Types.ObjectId;
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
  purchaserUserId: Types.ObjectId;
  purchaseBookingId: Types.ObjectId;
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
    type: { type: String, enum: ["purchase", "redeem", "refund"], required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
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
    purchaserUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purchaseBookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
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
giftCardSchema.index({ purchaseBookingId: 1 }, { unique: true });
giftCardSchema.index({ purchaserUserId: 1, createdAt: -1 });

export const GiftCard: Model<GiftCardAttrs> =
  (models.GiftCard as Model<GiftCardAttrs> | undefined) ??
  model<GiftCardAttrs>("GiftCard", giftCardSchema, "giftCards");
