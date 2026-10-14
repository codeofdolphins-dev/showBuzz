import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A monthly plan invoice for a subscription-billed vendor (one per vendor and month). Generated and marked paid by
 * hand by the super-admin (admin prompt 6, no online payment until a gateway is chosen); the partner portal only
 * reads them (Earnings → subscription).
 */
export interface SubscriptionInvoiceAttrs {
  vendorId: Types.ObjectId;
  planId: Types.ObjectId;
  /** "INV-2026-10-0001", shown to the vendor. */
  code: string;
  /** Billing month, "2026-10" (IST). */
  month: string;
  planName: string;
  amountPaise: number;
  status: "issued" | "paid" | "void";
  dueAt: Date;
  paidAt?: Date;
  reference?: string;
  /** Staff who generated it / recorded the payment / voided it. */
  issuedBy?: Types.ObjectId;
  paidBy?: Types.ObjectId;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionInvoiceSchema = new Schema<SubscriptionInvoiceAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    code: { type: String, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    planName: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["issued", "paid", "void"], required: true, default: "issued" },
    dueAt: { type: Date, required: true },
    paidAt: Date,
    reference: String,
    issuedBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    paidBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    voidReason: String,
  },
  { timestamps: true, versionKey: false },
);

subscriptionInvoiceSchema.index({ code: 1 }, { unique: true });
// Idempotent generation: one invoice per vendor and month.
subscriptionInvoiceSchema.index({ vendorId: 1, month: 1 }, { unique: true });
// The overdue view and the month filter.
subscriptionInvoiceSchema.index({ status: 1, dueAt: 1 });
subscriptionInvoiceSchema.index({ month: -1, status: 1 });

export const SubscriptionInvoice: Model<SubscriptionInvoiceAttrs> =
  (models.SubscriptionInvoice as Model<SubscriptionInvoiceAttrs> | undefined) ??
  model<SubscriptionInvoiceAttrs>("SubscriptionInvoice", subscriptionInvoiceSchema, "subscriptionInvoices");
