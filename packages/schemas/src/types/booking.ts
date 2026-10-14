import type { ContactDetails, PaymentMethod } from "../booking";
import type { CancellationPolicy } from "../vendor";
import type { GiftCardSummary } from "./gift-card";

export type BookingKind = "movie" | "sport" | "event" | "play" | "activity" | "gift-card";

export interface OrderAmounts {
  ticketsPaise: number;
  foodPaise: number;
  convenienceFeePaise: number;
  gstPaise: number;
  discountPaise: number;
  /** Order total (after discount, before any gift card). */
  totalPaise: number;
  /** Paid from a gift card balance (deducted only when the payment is confirmed). */
  giftCardPaise: number;
  /** What the payment gateway charges: total − gift card. 0 when a gift card covers everything. */
  payablePaise: number;
}

export interface QuoteFoodLine {
  foodItemId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
}

/** Server-computed price breakdown. The client only displays it. */
export interface OrderQuote {
  kind: BookingKind;
  title: string;
  poster: string;
  certificate?: string;
  format?: string;
  language?: string;
  venueName: string;
  screenName?: string;
  startsAt?: string;
  scheduleLabel: string;
  ticketLabel: string;
  seatLabels: string[];
  ticketCount: number;
  food: QuoteFoodLine[];
  /** True when the order can carry a food pre-order (cinema shows only). */
  foodAllowed: boolean;
  amounts: OrderAmounts;
  /** The vendor's rates used for the fee lines (shown as percentages); 0 for gift card orders. */
  rates: { convenienceFeeBps: number; gstBps: number };
  coupon?: { code: string; title: string };
  couponError?: string;
  /** The gift card applied to this quote (last 4 characters only). */
  giftCard?: { last4: string; appliedPaise: number; balancePaise: number };
  giftCardError?: string;
}

/**
 * pending_payment → confirmed → cancelled, or pending_payment → payment_failed / expired (inventory released).
 * Only confirmed and cancelled bookings are shown to the customer as tickets.
 */
export type BookingStatus = "pending_payment" | "confirmed" | "payment_failed" | "expired" | "cancelled";

export interface BookingRecord {
  code: string;
  /** Owner (users._id). Server-only: BookingView leaves it out. */
  userId: string;
  status: BookingStatus;
  kind: BookingKind;
  /** Set for seated and pass bookings (seat holds or tier inventory live on the show). */
  showId?: string;
  title: string;
  poster: string;
  certificate?: string;
  format?: string;
  language?: string;
  venueName: string;
  screenName?: string;
  startsAt?: string;
  scheduleLabel: string;
  ticketLabel: string;
  seatLabels: string[];
  ticketCount: number;
  food: QuoteFoodLine[];
  amounts: OrderAmounts;
  couponCode?: string;
  /** The vendor's cancellation terms when it was bought (older bookings: none, Settings apply). */
  cancellationPolicy?: CancellationPolicy;
  paymentMethod: PaymentMethod;
  contact: ContactDetails;
  bookedAt: string;
  cancellable: boolean;
  cancelledAt?: string;
  refundPaise?: number;
  /** Customer-facing reason for payment_failed / expired. */
  failureReason?: string;
  /** Gift card purchases: the card this booking issued (shown to its buyer). */
  issuedGiftCard?: GiftCardSummary;
}

/** A booking as shown to the customer, with time-dependent state resolved on the server. */
export interface BookingView extends Omit<BookingRecord, "userId"> {
  phase: "upcoming" | "past" | "cancelled";
  canCancel: boolean;
}
