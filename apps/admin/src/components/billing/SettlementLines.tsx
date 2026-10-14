import type { SettlementLine, SettlementTotals } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { Card } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";

/** "₹1,200" or "−₹300" (payout lines and totals can be negative). */
export const signedINR = (paise: number) => (paise < 0 ? `−${formatINR(-paise)}` : formatINR(paise));

/** The payout calculation, top to bottom (preview and payout detail). */
export function SettlementSummary({ totals }: { totals: SettlementTotals }) {
  const rows: [string, number, string?][] = [
    ["Gross sales (tickets + food − discounts)", totals.grossSalesPaise],
    ["− Commission", -totals.commissionPaise],
    ["− Already collected at the counter", -totals.counterCollectedPaise],
    [
      "− Cancellation adjustments",
      -totals.refundsPaise,
      "Bookings an earlier payout included that were cancelled since.",
    ],
  ];
  const owes = totals.netPayoutPaise < 0;
  return (
    <Card className="p-5">
      <dl className="divide-y divide-slate-100 text-xs">
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2">
            <dt className="text-admin-muted">
              {label}
              {hint ? <span className="block text-[10px] text-admin-subtle">{hint}</span> : null}
            </dt>
            <dd className="font-mono font-semibold text-admin-dark">{signedINR(value)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-3">
          <dt className="text-sm font-bold text-admin-dark">
            {owes ? "Vendor owes ShowBuzz" : "Net payout to vendor"}
          </dt>
          <dd className={`font-mono text-lg font-black ${owes ? "text-admin-danger" : "text-admin-success"}`}>
            {formatINR(Math.abs(totals.netPayoutPaise))}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-admin-subtle">
        {totals.bookings} booking{totals.bookings === 1 ? "" : "s"}
        {totals.clawbacks ? ` and ${totals.clawbacks} cancellation adjustment${totals.clawbacks === 1 ? "" : "s"}` : ""}
        . Convenience fees, their GST and cancellation fees on online bookings stay with ShowBuzz.
      </p>
    </Card>
  );
}

export function SettlementLinesTable({ title, lines }: { title: string; lines: SettlementLine[] }) {
  if (lines.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-admin-border px-4 py-3 text-sm font-bold text-admin-dark">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
            <tr>
              <th className="px-4 py-2">Booking</th>
              <th className="px-4 py-2">Show / listing</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2 text-right">Net sales</th>
              <th className="px-4 py-2 text-right">Commission</th>
              <th className="px-4 py-2 text-right">To payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.bookingId}>
                <td className="px-4 py-2 font-mono font-bold">
                  {l.code}
                  {l.status === "cancelled" ? <StatusBadge status="cancelled" className="ml-1.5" /> : null}
                </td>
                <td className="px-4 py-2">{l.title}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatDateShort(new Date(l.date))}, {formatTime(new Date(l.date))}
                </td>
                <td className="px-4 py-2 capitalize">{l.channel}</td>
                <td className="px-4 py-2 text-right font-mono">{formatINR(l.netSalesPaise)}</td>
                <td className="px-4 py-2 text-right font-mono">{formatINR(l.commissionPaise)}</td>
                <td
                  className={`px-4 py-2 text-right font-mono font-bold ${l.payoutPaise < 0 ? "text-admin-danger" : ""}`}
                >
                  {signedINR(l.payoutPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
