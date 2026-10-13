import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/** Money returned for a booking. One per booking (unique), so a repeated cancel can never refund twice. */
export interface RefundAttrs {
  bookingId: Types.ObjectId;
  /** Missing when a gift card paid the whole order (nothing went through the gateway). */
  paymentId?: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "simulated";
  providerRef: string;
  /** Refunded through the payment gateway. */
  amountPaise: number;
  /** Returned to the gift card that paid part of the booking (not sent to the gateway). */
  giftCardPaise: number;
  /** Cancellation fee kept (0 when the refund is because the booking could not be completed). */
  feePaise: number;
  reason: "cancelled" | "booking_failed";
  status: "processing" | "processed";
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<RefundAttrs>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["simulated"], required: true },
    providerRef: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    feePaise: { type: Number, required: true, min: 0 },
    giftCardPaise: { type: Number, default: 0, min: 0 },
    reason: { type: String, enum: ["cancelled", "booking_failed"], required: true },
    status: { type: String, enum: ["processing", "processed"], required: true },
    processedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

refundSchema.index({ bookingId: 1 }, { unique: true });

export const Refund: Model<RefundAttrs> =
  (models.Refund as Model<RefundAttrs> | undefined) ?? model<RefundAttrs>("Refund", refundSchema, "refunds");
