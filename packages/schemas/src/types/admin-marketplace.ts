import type { BillingModel, VendorBusinessType, VendorOnboardingStatus, VendorStatus } from "../vendor";
import type { VendorKycView, VendorSummary } from "./vendor";

/** Shapes the super-admin marketplace screens render (built by packages/core/src/services/admin/*). */

export interface AdminVendorRow {
  id: string;
  businessName: string;
  businessType: VendorBusinessType;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  cityName: string;
  status: VendorStatus;
  onboardingStatus: VendorOnboardingStatus;
  billingModel: BillingModel;
  /** "10% commission" / "Demo Monthly · ₹9,999/mo". */
  billingLabel: string;
  venues: number;
  events: number;
  /** Vendor sales (tickets + food − discount) of confirmed bookings, all time. */
  grossSalesPaise: number;
  createdAt: string;
}

export interface SalesSummary {
  bookings: number;
  tickets: number;
  salesPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
  refundsPaise: number;
}

export interface AdminVendorDetail {
  vendor: VendorSummary;
  /** Whole account number: the super-admin's vendor detail is one of the two places it is shown. */
  kyc: VendorKycView;
  cityName: string;
  suspendedAt?: string;
  suspendReason?: string;
  plan?: { id: string; name: string; monthlyFeePaise: number; active: boolean };
  login?: { name: string; email: string; status: "active" | "disabled"; lastLoginAt?: string };
  counts: { venues: number; events: number; upcomingShows: number; moviesCreated: number };
  sales: { allTime: SalesSummary; last30Days: SalesSummary };
  payouts: SettlementRow[];
  invoices: InvoiceRow[];
}

export interface PlanRow {
  id: string;
  name: string;
  monthlyFeePaise: number;
  active: boolean;
  vendors: number;
}

export interface InvoiceRow {
  id: string;
  code: string;
  vendorId: string;
  vendorName: string;
  month: string;
  planName: string;
  amountPaise: number;
  status: "issued" | "paid" | "void";
  overdue: boolean;
  dueAt: string;
  paidAt?: string;
  reference?: string;
  createdAt: string;
}

export interface GenerateInvoicesResult {
  month: string;
  created: number;
  alreadyIssued: number;
  /** Subscription vendors that can't be billed: no plan set. */
  withoutPlan: string[];
}

export interface SettlementRow {
  id: string;
  code: string;
  vendorId: string;
  vendorName: string;
  periodFrom: string;
  /** Last day included (IST date key). */
  periodToKey: string;
  periodFromKey: string;
  bookings: number;
  grossSalesPaise: number;
  commissionPaise: number;
  counterCollectedPaise: number;
  refundsPaise: number;
  netPayoutPaise: number;
  status: "pending" | "paid" | "void";
  reference?: string;
  paidAt?: string;
  createdAt: string;
}

/** One booking in a payout preview or payout detail. */
export interface SettlementLine {
  bookingId: string;
  code: string;
  title: string;
  /** Show start, or purchase time for undated passes. */
  date: string;
  channel: "online" | "counter";
  status: string;
  netSalesPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
  /** What this line adds to the payout (negative for counter sales and clawbacks). */
  payoutPaise: number;
}

export interface SettlementTotals {
  bookings: number;
  clawbacks: number;
  grossSalesPaise: number;
  commissionPaise: number;
  counterCollectedPaise: number;
  refundsPaise: number;
  netPayoutPaise: number;
}

export interface SettlementPreview {
  vendorId: string;
  vendorName: string;
  billingModel: BillingModel;
  fromDate: string;
  toDate: string;
  totals: SettlementTotals;
  lines: SettlementLine[];
  clawbackLines: SettlementLine[];
  /** Lines are capped for display; totals cover everything. */
  truncated: boolean;
}

export interface SettlementDetail extends SettlementRow {
  billingModel: BillingModel;
  bankAccount: { holderName: string; accountNumberMasked: string; ifsc: string };
  lines: SettlementLine[];
  clawbackLines: SettlementLine[];
  voidReason?: string;
}

export interface AdminPaymentRow {
  id: string;
  bookingCode: string;
  customerName: string;
  title: string;
  vendorName: string;
  amountPaise: number;
  method: string;
  provider: "simulated" | "counter";
  providerRef: string;
  reference?: string;
  status: "created" | "succeeded" | "failed";
  failureReason?: string;
  createdAt: string;
}

export interface AdminRefundRow {
  id: string;
  bookingCode: string;
  customerName: string;
  vendorName: string;
  originalPaise: number;
  amountPaise: number;
  giftCardPaise: number;
  feePaise: number;
  reason: "cancelled" | "booking_failed";
  cancelledBy?: "customer" | "vendor";
  cancelReason?: string;
  provider: "simulated" | "counter";
  status: "processing" | "processed";
  createdAt: string;
  processedAt?: string;
}

export interface ShowRequestRow {
  id: string;
  reference: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  capacity: string;
  status: "new" | "in_progress" | "closed";
  vendorId?: string;
  notes: number;
  createdAt: string;
}

export interface ShowRequestDetail extends ShowRequestRow {
  overview: string;
  vendorName?: string;
  notesList: { text: string; staffName: string; at: string }[];
}

export interface AdminMovieRow {
  id: string;
  slug: string;
  title: string;
  poster: string;
  languages: string[];
  releaseDate: string;
  status: "now-showing" | "upcoming";
  createdBy: string;
  vendors: number;
  upcomingShows: number;
  archived: boolean;
  mergedIntoTitle?: string;
}

export interface AdminMovieDetail extends AdminMovieRow {
  certificate: string;
  durationMinutes: number;
  genres: string[];
  synopsis: string;
  vendorNames: string[];
  totalShows: number;
  reviews: number;
  mergedIntoId?: string;
  mergedFrom: { id: string; title: string }[];
}

export interface MovieMergePreview {
  source: { id: string; title: string; slug: string };
  keep: { id: string; title: string; slug: string };
  shows: number;
  /** Demo template shows that clash with one of the kept film's and will be cancelled instead of moved. */
  showsCancelled: number;
  vendorLinks: number;
  reviews: number;
  reviewsHidden: number;
  wishlists: number;
  coupons: number;
}
