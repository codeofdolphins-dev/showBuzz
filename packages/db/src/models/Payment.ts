import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { BookingPaymentMethod } from "@showbuzz/schemas/booking";

/**
 * One payment attempt for a booking at the gateway. Only the server marks it succeeded (gateway-confirmed).
 * Counter sales record their cash/UPI payment with provider `counter` (no gateway, no customer account).
 */
export interface PaymentAttrs {
  bookingId: Types.ObjectId;
  /** Absent on counter sales. */
  userId?: Types.ObjectId;
  /** The booking's vendor (absent for gift card purchases, which are platform sales). */
  vendorId?: Types.ObjectId;
  provider: "simulated" | "razorpay" | "counter";
  /** The gateway's order id, created before the customer pays (Razorpay: `order_…`). */
  providerRef: string;
  /**
   * The gateway's own payment id, captured at confirmation (Razorpay: `pay_…`). Refunds go against this,
   * not `providerRef`, because Razorpay refunds a payment and not the order it belonged to.
   */
  gatewayPaymentRef?: string;
  amountPaise: number;
  method: BookingPaymentMethod;
  status: "created" | "succeeded" | "failed";
  failureReason?: string;
  /** Counter UPI sales: the transaction reference typed at the counter. */
  reference?: string;
  succeededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentAttrs>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    provider: { type: String, enum: ["simulated", "razorpay", "counter"], required: true },
    providerRef: { type: String, required: true },
    gatewayPaymentRef: String,
    amountPaise: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["online", "upi", "card", "netbanking", "wallet", "counter_cash", "counter_upi"],
      required: true,
    },
    status: { type: String, enum: ["created", "succeeded", "failed"], required: true, default: "created" },
    failureReason: String,
    reference: String,
    succeededAt: Date,
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ provider: 1, providerRef: 1 }, { unique: true });
paymentSchema.index({ bookingId: 1, createdAt: -1 });
paymentSchema.index({ vendorId: 1, createdAt: -1 });

export const Payment: Model<PaymentAttrs> =
  (models.Payment as Model<PaymentAttrs> | undefined) ?? model<PaymentAttrs>("Payment", paymentSchema, "payments");
