import type { PaymentMethod } from "@showbuzz/schemas/booking";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Credit / Debit Card",
  netbanking: "Net Banking",
  wallet: "Mobile Wallet",
};
