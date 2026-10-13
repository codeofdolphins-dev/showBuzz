export type GiftCardStatus = "active" | "redeemed" | "expired" | "cancelled";

/** A gift card as shown to its buyer (success page, My Bookings, profile). */
export interface GiftCardSummary {
  /** Formatted, e.g. "ABCD-1234-EFGH-5678". */
  code: string;
  designName?: string;
  gradient?: string;
  amountPaise: number;
  balancePaise: number;
  /** Effective status: an active card past `expiresAt` shows as expired. */
  status: GiftCardStatus;
  expiresAt: string;
  recipientName: string;
  recipientContact: string;
  message?: string;
  purchasedAt: string;
}
