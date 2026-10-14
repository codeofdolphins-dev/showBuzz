import type { BookingPaymentMethod } from "@showbuzz/schemas/booking";

export const PAYMENT_METHOD_LABELS: Record<BookingPaymentMethod, string> = {
  upi: "UPI",
  card: "Credit / Debit Card",
  netbanking: "Net Banking",
  wallet: "Mobile Wallet",
  counter_cash: "Cash at counter",
  counter_upi: "UPI at counter",
};

/** How an order was paid: the gateway method, a gift card, or both. */
export function paymentLabel(
  method: BookingPaymentMethod,
  amounts: { giftCardPaise: number; payablePaise: number },
): string {
  if (amounts.giftCardPaise <= 0) return PAYMENT_METHOD_LABELS[method];
  return amounts.payablePaise === 0 ? "Gift Card" : `${PAYMENT_METHOD_LABELS[method]} + Gift Card`;
}
