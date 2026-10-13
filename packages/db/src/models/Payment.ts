import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/** One payment attempt for a booking at the gateway. Only the server marks it succeeded (gateway-confirmed). */
export interface PaymentAttrs {
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "simulated";
  /** The gateway's order/payment id. */
  providerRef: string;
  amountPaise: number;
  method: "upi" | "card" | "netbanking" | "wallet";
  status: "created" | "succeeded" | "failed";
  failureReason?: string;
  succeededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentAttrs>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["simulated"], required: true },
    providerRef: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["upi", "card", "netbanking", "wallet"], required: true },
    status: { type: String, enum: ["created", "succeeded", "failed"], required: true, default: "created" },
    failureReason: String,
    succeededAt: Date,
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ provider: 1, providerRef: 1 }, { unique: true });
paymentSchema.index({ bookingId: 1, createdAt: -1 });

export const Payment: Model<PaymentAttrs> =
  (models.Payment as Model<PaymentAttrs> | undefined) ?? model<PaymentAttrs>("Payment", paymentSchema, "payments");
