import type { ContactDetails, PaymentMethod } from "../booking";

export type BookingKind = "movie" | "sport" | "event" | "play" | "activity" | "gift-card";

export interface OrderAmounts {
  ticketsPaise: number;
  foodPaise: number;
  convenienceFeePaise: number;
  gstPaise: number;
  discountPaise: number;
  totalPaise: number;
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
  coupon?: { code: string; title: string };
  couponError?: string;
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
  paymentMethod: PaymentMethod;
  contact: ContactDetails;
  bookedAt: string;
  cancellable: boolean;
  cancelledAt?: string;
  refundPaise?: number;
  /** Customer-facing reason for payment_failed / expired. */
  failureReason?: string;
}

/** A booking as shown to the customer, with time-dependent state resolved on the server. */
export interface BookingView extends Omit<BookingRecord, "userId"> {
  phase: "upcoming" | "past" | "cancelled";
  canCancel: boolean;
}
