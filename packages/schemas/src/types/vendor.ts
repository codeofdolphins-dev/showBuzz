import type {
  BankAccount,
  BillingModel,
  CancellationPolicy,
  KycDocument,
  VendorAddress,
  VendorBusinessType,
  VendorContact,
  VendorOnboardingStatus,
  VendorStatus,
} from "../vendor";

/** What the public site may know about a vendor: its name and its customer-facing policy. Never KYC. */
export interface VendorPublic {
  id: string;
  slug: string;
  businessName: string;
  businessType: VendorBusinessType;
  cancellation: CancellationPolicy;
}

/**
 * The vendor as the super-admin's vendor detail and the vendor's own KYC screen see it: the only shape that
 * carries the whole bank account number.
 */
export interface VendorKycView {
  gstin: string;
  pan: string;
  bankAccount: BankAccount;
  documents: KycDocument[];
}

/** The vendor everywhere else in the back office: bank account masked. */
export interface VendorSummary extends VendorPublic {
  contact: VendorContact;
  address: VendorAddress;
  onboardingStatus: VendorOnboardingStatus;
  status: VendorStatus;
  billingModel: BillingModel;
  planId?: string;
  commissionBps: number;
  convenienceFeeBps: number;
  gstBps: number;
  shareCustomerContact: boolean;
  kyc: { gstin: string; pan: string; bankAccount: { holderName: string; accountNumberMasked: string; ifsc: string } };
  createdAt: string;
  updatedAt: string;
}

/**
 * Money split of one booking, frozen when the order is placed (later rate changes never touch it).
 * Vendor sales = tickets + food. Commission = commissionBps × (sales − discount) for commission vendors, 0 for
 * subscription vendors. The convenience fee and its GST belong to the platform.
 */
export interface BookingSettlement {
  billingModel: BillingModel;
  commissionBps: number;
  convenienceFeeBps: number;
  gstBps: number;
  subtotalPaise: number;
  discountPaise: number;
  convenienceFeePaise: number;
  gstPaise: number;
  totalPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
}
