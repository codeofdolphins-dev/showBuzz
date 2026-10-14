import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";

/** No real payment gateway yet: online money goes through the simulated one, counter money is only recorded. */
export function ProviderBadge({ provider }: { provider: "simulated" | "counter" }) {
  return provider === "simulated" ? (
    <StatusBadge tone="warning">Simulated gateway</StatusBadge>
  ) : (
    <StatusBadge tone="info">Counter</StatusBadge>
  );
}

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "NetBanking",
  wallet: "Wallet",
  counter_cash: "Cash at counter",
  counter_upi: "UPI at counter",
};

export const methodLabel = (method: string) => METHOD_LABELS[method] ?? method;
