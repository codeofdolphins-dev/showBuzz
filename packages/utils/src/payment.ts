import type { PaymentMethod } from "@showbuzz/schemas/booking";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Credit / Debit Card",
  netbanking: "Net Banking",
  wallet: "Mobile Wallet",
};

/** How an order was paid: the gateway method, a gift card, or both. */
export function paymentLabel(method: PaymentMethod, amounts: { giftCardPaise: number; payablePaise: number }): string {
  if (amounts.giftCardPaise <= 0) return PAYMENT_METHOD_LABELS[method];
  return amounts.payablePaise === 0 ? "Gift Card" : `${PAYMENT_METHOD_LABELS[method]} + Gift Card`;
}
