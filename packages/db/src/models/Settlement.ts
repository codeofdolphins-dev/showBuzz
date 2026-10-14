import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A payout to a vendor for a period: the vendor share of its confirmed bookings minus refunds. Created and marked
 * paid by the super-admin (admin prompt 6); the partner portal only reads them (Earnings → payouts received).
 * A booking belongs to at most one settlement (`bookingIds`, unique per booking via the multikey index).
 */
export interface SettlementAttrs {
  vendorId: Types.ObjectId;
  /** "SET-2026-10-0001", shown to the vendor. */
  code: string;
  periodFrom: Date;
  periodTo: Date;
  bookingIds: Types.ObjectId[];
  grossSalesPaise: number;
  commissionPaise: number;
  refundsPaise: number;
  netPayoutPaise: number;
  status: "pending" | "paid";
  /** Bank transfer reference (UTR) once paid. */
  reference?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const settlementSchema = new Schema<SettlementAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    code: { type: String, required: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    bookingIds: { type: [Schema.Types.ObjectId], ref: "Booking", default: [] },
    grossSalesPaise: { type: Number, required: true, min: 0 },
    commissionPaise: { type: Number, required: true, min: 0 },
    refundsPaise: { type: Number, required: true, min: 0 },
    netPayoutPaise: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid"], required: true, default: "pending" },
    reference: String,
    paidAt: Date,
  },
  { timestamps: true, versionKey: false },
);

settlementSchema.index({ code: 1 }, { unique: true });
settlementSchema.index({ vendorId: 1, periodTo: -1 });
settlementSchema.index(
  { bookingIds: 1 },
  { unique: true, partialFilterExpression: { "bookingIds.0": { $exists: true } } },
);

export const Settlement: Model<SettlementAttrs> =
  (models.Settlement as Model<SettlementAttrs> | undefined) ??
  model<SettlementAttrs>("Settlement", settlementSchema, "settlements");
