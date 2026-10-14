import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A payout to a vendor for a period, created and marked paid by the super-admin; the partner portal only reads them
 * (Earnings → payouts).
 *
 * Net payout = gross sales − commission − what the vendor already collected at its counter − clawbacks:
 * - `bookingIds`: confirmed bookings whose show date (purchase date for undated passes) is in the period. Online
 *   sales were paid to the platform, so the vendor share is owed; counter sales were paid to the vendor, so only the
 *   commission is owed back (the net can be negative: the vendor owes the platform).
 * - `clawbackBookingIds`: bookings an earlier payout included that were cancelled afterwards; their vendor share
 *   (or, for counter sales, minus their commission) is taken back.
 *
 * A booking belongs to at most one payout and at most one clawback (unique multikey indexes, plus `settlementId` /
 * `clawbackSettlementId` on the booking). Voiding a pending payout moves its ids to the `voided*` lists, so the
 * bookings can be paid out again.
 */
export interface SettlementAttrs {
  vendorId: Types.ObjectId;
  /** "SET-2026-10-0001", shown to the vendor. */
  code: string;
  periodFrom: Date;
  /** Exclusive end (00:00 IST of the day after the last day). */
  periodTo: Date;
  bookingIds: Types.ObjectId[];
  clawbackBookingIds: Types.ObjectId[];
  voidedBookingIds: Types.ObjectId[];
  voidedClawbackBookingIds: Types.ObjectId[];
  /** Vendor sales (tickets + food − discount) of the bookings in the period, online and counter. */
  grossSalesPaise: number;
  commissionPaise: number;
  /** Counter sales the vendor took in cash/UPI itself (already in its hands). */
  counterCollectedPaise: number;
  /**
   * Cancellation adjustments: what earlier payouts counted for bookings cancelled since (an online booking's share
   * is taken back; a counter sale's commission is given back, so its adjustment is negative).
   */
  refundsPaise: number;
  netPayoutPaise: number;
  status: "pending" | "paid" | "void";
  /** Bank transfer reference (UTR) once paid. */
  reference?: string;
  paidAt?: Date;
  createdBy?: Types.ObjectId;
  paidBy?: Types.ObjectId;
  voidedAt?: Date;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ids = () => ({ type: [Schema.Types.ObjectId], ref: "Booking", default: [] });

const settlementSchema = new Schema<SettlementAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    code: { type: String, required: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    bookingIds: ids(),
    clawbackBookingIds: ids(),
    voidedBookingIds: ids(),
    voidedClawbackBookingIds: ids(),
    grossSalesPaise: { type: Number, required: true, min: 0 },
    commissionPaise: { type: Number, required: true, min: 0 },
    counterCollectedPaise: { type: Number, default: 0, min: 0 },
    // Negative when cancelled counter sales give their commission back.
    refundsPaise: { type: Number, required: true },
    netPayoutPaise: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "void"], required: true, default: "pending" },
    reference: String,
    paidAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    paidBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    voidedAt: Date,
    voidReason: String,
  },
  { timestamps: true, versionKey: false },
);

settlementSchema.index({ code: 1 }, { unique: true });
settlementSchema.index({ vendorId: 1, periodTo: -1 });
settlementSchema.index({ status: 1, createdAt: -1 });
settlementSchema.index(
  { bookingIds: 1 },
  { unique: true, partialFilterExpression: { "bookingIds.0": { $exists: true } } },
);
settlementSchema.index(
  { clawbackBookingIds: 1 },
  { unique: true, partialFilterExpression: { "clawbackBookingIds.0": { $exists: true } } },
);

export const Settlement: Model<SettlementAttrs> =
  (models.Settlement as Model<SettlementAttrs> | undefined) ??
  model<SettlementAttrs>("Settlement", settlementSchema, "settlements");
