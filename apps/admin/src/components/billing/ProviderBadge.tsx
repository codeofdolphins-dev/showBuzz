import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";

/** No real payment gateway yet: online money goes through the simulated one, counter money is only recorded. */
export function ProviderBadge({ provider }: { provider: "simulated" | "razorpay" | "counter" }) {
  if (provider === "simulated") return <StatusBadge tone="warning">Simulated gateway</StatusBadge>;
  if (provider === "razorpay") return <StatusBadge tone="success">Razorpay</StatusBadge>;
  return <StatusBadge tone="info">Counter</StatusBadge>;
}

const METHOD_LABELS: Record<string, string> = {
  online: "Online",
  upi: "UPI",
  card: "Card",
  netbanking: "NetBanking",
  wallet: "Wallet",
  counter_cash: "Cash at counter",
  counter_upi: "UPI at counter",
};

export const methodLabel = (method: string) => METHOD_LABELS[method] ?? method;
