import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import {
  type BillingModel,
  type CancellationPolicy,
  type KycDocumentKind,
  type VendorAddress,
  type VendorBusinessType,
  type VendorContact,
  type VendorOnboardingStatus,
  type VendorStatus,
  maskAccountNumber,
} from "@showbuzz/schemas/vendor";
import type { VendorKycView, VendorPublic, VendorSummary } from "@showbuzz/schemas/types/vendor";
import type { LeanDoc } from "./transforms";

/**
 * A business selling on ShowBuzz. Owns venues, events, shows, food items, vendor coupons and bookings
 * (`vendorId` on each). Its rates and cancellation policy price and govern its own shows.
 *
 * The bank account number is stored whole (the payout needs it) but only `toVendorKyc` returns it, for the
 * vendor's own KYC screen and the super-admin's vendor detail. Every other mapper masks it or leaves KYC out.
 */
export interface StoredKycDocument {
  fileId: Types.ObjectId;
  kind: KycDocumentKind;
  filename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  size: number;
  uploadedAt: Date;
}

export interface VendorAttrs {
  businessName: string;
  slug: string;
  businessType: VendorBusinessType;
  contact: VendorContact;
  address: VendorAddress;
  kyc: {
    gstin?: string;
    pan?: string;
    bankAccount?: { holderName: string; accountNumber: string; ifsc: string };
    documents: StoredKycDocument[];
  };
  onboardingStatus: VendorOnboardingStatus;
  status: VendorStatus;
  billingModel: BillingModel;
  /** Subscription vendors only. */
  planId?: Types.ObjectId;
  commissionBps: number;
  convenienceFeeBps: number;
  gstBps: number;
  cancellation: CancellationPolicy;
  /** Vendors see customer phone/email on their bookings only when the super-admin turns this on. */
  shareCustomerContact: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const kycDocumentSchema = new Schema<StoredKycDocument>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["gst_certificate", "pan_card", "cancelled_cheque", "other"], required: true },
    filename: { type: String, required: true },
    contentType: { type: String, enum: ["application/pdf", "image/jpeg", "image/png"], required: true },
    size: { type: Number, required: true, min: 1 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

const bps = { type: Number, required: true, min: 0, max: 10_000 } as const;

const vendorSchema = new Schema<VendorAttrs>(
  {
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    businessType: {
      type: String,
      enum: ["cinema_chain", "event_organiser", "venue_operator", "other"],
      required: true,
    },
    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
    },
    address: {
      line: { type: String, default: "" },
      cityId: { type: String, required: true },
      pincode: { type: String, default: "" },
    },
    kyc: {
      gstin: String,
      pan: String,
      bankAccount: { type: new Schema({ holderName: String, accountNumber: String, ifsc: String }, { _id: false }) },
      documents: { type: [kycDocumentSchema], default: [] },
    },
    onboardingStatus: { type: String, enum: ["incomplete", "complete"], default: "incomplete", required: true },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
    billingModel: { type: String, enum: ["subscription", "commission"], required: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan" },
    commissionBps: { ...bps, default: 0 },
    convenienceFeeBps: bps,
    gstBps: bps,
    cancellation: {
      allowed: { type: Boolean, required: true },
      cutoffMinutes: { type: Number, required: true, min: 0 },
      feePaise: { type: Number, required: true, min: 0 },
    },
    shareCustomerContact: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

vendorSchema.index({ slug: 1 }, { unique: true });
vendorSchema.index({ status: 1, businessName: 1 });

type LeanVendor = LeanDoc<VendorAttrs>;

export function toVendorPublic(doc: LeanVendor): VendorPublic {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    businessName: doc.businessName,
    businessType: doc.businessType,
    cancellation: {
      allowed: doc.cancellation.allowed,
      cutoffMinutes: doc.cancellation.cutoffMinutes,
      feePaise: doc.cancellation.feePaise,
    },
  };
}

/** Back-office shape with the account number masked. */
export function toVendorSummary(doc: LeanVendor): VendorSummary {
  const bank = doc.kyc.bankAccount;
  return {
    ...toVendorPublic(doc),
    contact: { name: doc.contact.name, email: doc.contact.email, phone: doc.contact.phone },
    address: { line: doc.address.line, cityId: doc.address.cityId, pincode: doc.address.pincode },
    onboardingStatus: doc.onboardingStatus,
    status: doc.status,
    billingModel: doc.billingModel,
    ...(doc.planId ? { planId: doc.planId.toString() } : {}),
    commissionBps: doc.commissionBps,
    convenienceFeeBps: doc.convenienceFeeBps,
    gstBps: doc.gstBps,
    shareCustomerContact: doc.shareCustomerContact,
    kyc: {
      gstin: doc.kyc.gstin ?? "",
      pan: doc.kyc.pan ?? "",
      bankAccount: {
        holderName: bank?.holderName ?? "",
        accountNumberMasked: bank?.accountNumber ? maskAccountNumber(bank.accountNumber) : "",
        ifsc: bank?.ifsc ?? "",
      },
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Full KYC including the whole account number: the vendor's own KYC screen and the super-admin's detail only. */
export function toVendorKyc(doc: LeanVendor): VendorKycView {
  return {
    gstin: doc.kyc.gstin ?? "",
    pan: doc.kyc.pan ?? "",
    bankAccount: {
      holderName: doc.kyc.bankAccount?.holderName ?? "",
      accountNumber: doc.kyc.bankAccount?.accountNumber ?? "",
      ifsc: doc.kyc.bankAccount?.ifsc ?? "",
    },
    documents: doc.kyc.documents.map((d) => ({
      fileId: d.fileId.toString(),
      kind: d.kind,
      filename: d.filename,
      contentType: d.contentType,
      size: d.size,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
  };
}

export const Vendor: Model<VendorAttrs> =
  (models.Vendor as Model<VendorAttrs> | undefined) ?? model<VendorAttrs>("Vendor", vendorSchema, "vendors");
