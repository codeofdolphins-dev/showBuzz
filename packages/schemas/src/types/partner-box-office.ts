import type { BookingPaymentMethod } from "../booking";
import type { FoodCategory } from "../food";
import type { BillingModel, CancellationPolicy } from "../vendor";
import type { BookingKind, BookingStatus, OrderAmounts, QuoteFoodLine } from "./booking";
import type { BookingSettlement } from "./vendor";

/** Partner portal box-office views (built in core/services/partner, always for the session's vendor). */

/** Customer contact on a vendor's booking: only present when the super-admin turned on contact sharing. */
export interface SharedContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface VendorBookingRow {
  code: string;
  status: BookingStatus;
  kind: BookingKind;
  channel: "online" | "counter";
  title: string;
  venueName: string;
  screenName?: string;
  startsAt?: string;
  scheduleLabel: string;
  seatLabels: string[];
  ticketCount: number;
  totalPaise: number;
  paymentMethod: BookingPaymentMethod;
  bookedAt: string;
  checkedInAt?: string;
  /** Walk-in name on counter sales, or the shared customer contact (contact sharing on). */
  contact?: SharedContact;
}

export interface VendorBookingDetail extends VendorBookingRow {
  ticketLabel: string;
  format?: string;
  language?: string;
  food: QuoteFoodLine[];
  amounts: OrderAmounts;
  couponCode?: string;
  settlement?: BookingSettlement;
  policy: { allowed: boolean; cutoffMinutes: number; feePaise: number };
  /** Inside the vendor's own policy right now (otherwise a cancellation needs a reason). */
  withinPolicy: boolean;
  /** The vendor can still cancel it (confirmed and not yet started). */
  vendorCanCancel: boolean;
  cancelledAt?: string;
  cancelledBy?: "customer" | "vendor" | "staff";
  cancelReason?: string;
  refundPaise?: number;
  checkedInByName?: string;
  soldByName?: string;
  /** Counter sales: the UPI reference typed at the counter. */
  paymentReference?: string;
  /** The signed ticket QR (SVG), for confirmed bookings: reprint at the counter. */
  qrSvg?: string;
}

/** What the gate scanner shows after a scan. */
export type CheckInResult =
  | {
      outcome: "checked_in" | "already_checked_in";
      ticket: {
        code: string;
        title: string;
        venueName: string;
        screenName?: string;
        startsAt?: string;
        seatLabels: string[];
        ticketCount: number;
      };
      checkedInAt: string;
      checkedInByName?: string;
    }
  | {
      outcome: "rejected";
      reason: "malformed" | "bad_signature" | "not_found" | "not_confirmed" | "mismatch";
      message: string;
      code?: string;
    };

/** Show options for the counter (today and upcoming): seated shows and event pass listings. */
export interface CounterShowOption {
  id: string;
  label: string;
  kind: "seats" | "passes";
}

export interface CounterPassTier {
  id: string;
  name: string;
  pricePaise: number;
  remaining: number;
}

export interface CounterPassListing {
  eventId: string;
  title: string;
  venueName: string;
  scheduleLabel: string;
  tiers: CounterPassTier[];
}

export interface CounterSaleResult {
  code: string;
  title: string;
  venueName: string;
  screenName?: string;
  scheduleLabel: string;
  seatLabels: string[];
  ticketCount: number;
  totalPaise: number;
  paymentMethod: BookingPaymentMethod;
  customerName?: string;
  qrSvg: string;
}

export interface VendorFoodRow {
  id: string;
  name: string;
  category: FoodCategory;
  isVeg: boolean;
  pricePaise: number;
  size: string;
  image: string;
  description: string;
  venueIds: string[];
  /** "All my cinemas" or the venue names. */
  venuesLabel: string;
  available: boolean;
}

export interface VendorCouponRow {
  id: string;
  code: string;
  title: string;
  description: string;
  kind: "percent" | "flat" | "bogo";
  percentBps?: number;
  flatPaise?: number;
  maxDiscountPaise?: number;
  minOrderPaise: number;
  appliesTo: "tickets" | "food";
  validFrom?: string;
  validUntil: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  usedCount: number;
  venueIds: string[];
  movieIds: string[];
  eventIds: string[];
  scopeLabel: string;
  showOnOffersPage: boolean;
  gradient: string;
  terms: string[];
  status: "active" | "inactive";
  /** Live = active and inside its dates; otherwise why not. */
  phase: "live" | "scheduled" | "expired" | "inactive" | "used_up";
}

export interface EarningsPeriodRow {
  /** "2026-10-14", "2026-W42" or "2026-10". */
  key: string;
  label: string;
  bookings: number;
  tickets: number;
  salesPaise: number;
  discountPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
  refundsPaise: number;
  cancellationFeesPaise: number;
}

export interface EarningsTotals {
  bookings: number;
  tickets: number;
  salesPaise: number;
  discountPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
  /** Money returned to customers for cancelled bookings (gateway + gift card + counter). */
  refundsPaise: number;
  /** Cancellation fees kept on cancelled bookings (who keeps them is settled with payouts). */
  cancellationFeesPaise: number;
}

export interface PayoutRow {
  id: string;
  code: string;
  periodFrom: string;
  /** Last moment of the payout period (its last IST day). */
  periodTo: string;
  grossSalesPaise: number;
  commissionPaise: number;
  /** Counter sales the vendor collected itself (deducted: the money is already with the vendor). */
  counterCollectedPaise: number;
  /** Cancellation adjustments for bookings an earlier payout included (negative = given back). */
  refundsPaise: number;
  /** Negative when the vendor owes ShowBuzz (counter commission). */
  netPayoutPaise: number;
  status: "pending" | "paid";
  reference?: string;
  paidAt?: string;
}

export interface InvoiceRow {
  id: string;
  code: string;
  month: string;
  planName: string;
  amountPaise: number;
  status: "issued" | "paid" | "void";
  dueAt: string;
  paidAt?: string;
  reference?: string;
  overdue: boolean;
}

export interface VendorEarnings {
  billingModel: BillingModel;
  commissionBps: number;
  planName?: string;
  planFeePaise?: number;
  from: string;
  to: string;
  rows: EarningsPeriodRow[];
  totals: EarningsTotals;
  payouts: PayoutRow[];
  invoices: InvoiceRow[];
}

export interface VendorPolicyView {
  policy: CancellationPolicy;
  /** Venues where cancellation is switched off (venue setting wins over the policy). */
  venuesWithoutCancellation: string[];
}
