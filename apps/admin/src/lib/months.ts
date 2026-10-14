import { istDateKey } from "@showbuzz/utils/dates";

/** IST billing months for pickers: next month, this month and the `count - 2` before it ("2026-10" → "Oct 2026"). */
export function billingMonthOptions(now: Date, count = 13): { value: string; label: string }[] {
  const [y, m] = istDateKey(now).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + 1 - i, 15));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { value, label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) };
  });
}

export const currentBillingMonth = (now: Date) => istDateKey(now).slice(0, 7);
