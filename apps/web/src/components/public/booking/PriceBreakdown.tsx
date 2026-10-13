import { PRICING_DEFAULTS } from "@showbuzz/schemas/constants";
import { formatINR } from "@showbuzz/utils/money";
import type { OrderQuote } from "@showbuzz/schemas/types/booking";

/** Server-computed bill. Rendered on food, checkout and payment steps. */
export function PriceBreakdown({ quote }: { quote: OrderQuote }) {
  const a = quote.amounts;
  const feePct = PRICING_DEFAULTS.convenienceFeeBps / 100;
  const gstPct = PRICING_DEFAULTS.gstBps / 100;
  return (
    <div className="space-y-2 text-xs">
      <Row label={`Ticket Base (${quote.ticketCount} ${quote.ticketCount === 1 ? "Ticket" : "Tickets"})`} value={formatINR(a.ticketsPaise, { exact: true })} />
      {quote.foodAllowed && <Row label="Food & Beverages" value={formatINR(a.foodPaise, { exact: true })} />}
      {a.convenienceFeePaise > 0 && (
        <>
          <Row label={`Convenience Fee (${feePct}%)`} value={formatINR(a.convenienceFeePaise, { exact: true })} />
          <Row label={`GST on fee (${gstPct}%)`} value={formatINR(a.gstPaise, { exact: true })} />
        </>
      )}
      {a.discountPaise > 0 && (
        <div className="flex justify-between font-bold text-emerald-600">
          <span>Discount ({quote.coupon?.code})</span>
          <span>-{formatINR(a.discountPaise, { exact: true })}</span>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}
