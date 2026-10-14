import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@showbuzz/utils/cn";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { EARNINGS_MAX_DAYS, getVendorEarnings } from "@showbuzz/core/services/partner/earnings.service";
import { earningsGroupingSchema } from "@showbuzz/schemas/partner-box-office";
import type { InvoiceRow, PayoutRow, VendorEarnings } from "@showbuzz/schemas/types/partner-box-office";
import { addDaysToKey, formatDateShort, isDateKey, istDateKey } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Earnings" };

const money = (paise: number) => formatINR(paise, { exact: true });
const GROUPING_LABELS = { day: "Daily", week: "Weekly", month: "Monthly" } as const;

/**
 * Prototype settlements.html, from the vendor's side: sales, discounts, refunds, commission and its share per day /
 * week / month (IST, by purchase time), payouts received and, for subscription vendors, plan invoices. Read-only.
 */
export default async function EarningsPage({ searchParams }: PageProps<"/earnings">) {
  const { vendor } = await requireVendorPage("/earnings");
  const sp = await searchParams;
  const now = new Date();
  const today = istDateKey(now);
  const rawTo = param(sp, "to") ?? "";
  const rawFrom = param(sp, "from") ?? "";
  const toKey = isDateKey(rawTo) ? rawTo : today;
  const fromKey = isDateKey(rawFrom) && rawFrom <= toKey ? rawFrom : addDaysToKey(toKey, -29);
  const grouping = earningsGroupingSchema.catch("day").parse(param(sp, "group"));
  const result = await load(() => getVendorEarnings(vendor.id, { fromKey, toKey, grouping }, now));

  return (
    <>
      <PageHeader
        title="Earnings"
        crumb="Earnings"
        subtitle="Your sales and share from every booking, online and at the counter. Read-only."
      />
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-admin-border bg-white p-4 shadow-card"
      >
        <DateInput name="from" label="From" value={fromKey} />
        <DateInput name="to" label="To" value={toKey} />
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-admin-muted">Group by</span>
          <select
            name="group"
            defaultValue={grouping}
            className="rounded-md border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text"
          >
            {Object.entries(GROUPING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-admin-indigo bg-admin-indigo px-4 py-1.5 text-xs font-bold text-white hover:bg-admin-dark"
        >
          Show
        </button>
        <span className="text-[11px] text-admin-subtle">Up to {EARNINGS_MAX_DAYS} days, IST.</span>
      </form>

      {!result.ok ? (
        <TableError message="Earnings couldn't be loaded. Check the dates and try again." />
      ) : (
        <Report data={result.data} />
      )}
    </>
  );
}

function Report({ data }: { data: VendorEarnings }) {
  const { totals } = data;
  const commission = data.billingModel === "commission";
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Gross sales"
          value={money(totals.salesPaise)}
          hint={`${totals.bookings} bookings · ${totals.tickets} tickets`}
        />
        <Kpi label="Discounts" value={money(totals.discountPaise)} hint="Your coupons" />
        <Kpi
          label="Refunds"
          value={money(totals.refundsPaise)}
          hint={`Fees kept ${money(totals.cancellationFeesPaise)}`}
        />
        <Kpi
          label="ShowBuzz commission"
          value={money(totals.commissionPaise)}
          hint={
            commission
              ? `${(data.commissionBps / 100).toFixed(2).replace(/\.00$/, "")}% of net sales`
              : "Subscription: no commission"
          }
        />
        <Kpi label="Your share" value={money(totals.vendorSharePaise)} hint="Bookings still confirmed" strong />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Earnings by period</caption>
            <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <Th>Period</Th>
                <Th right>Bookings</Th>
                <Th right>Tickets</Th>
                <Th right>Gross sales</Th>
                <Th right>Discounts</Th>
                <Th right>Refunds</Th>
                <Th right>Commission</Th>
                <Th right>Your share</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No sales in this period" description="Pick another date range." />
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <Td>{r.label}</Td>
                    <Td right>{r.bookings}</Td>
                    <Td right>{r.tickets}</Td>
                    <Td right mono>
                      {money(r.salesPaise)}
                    </Td>
                    <Td right mono>
                      {money(r.discountPaise)}
                    </Td>
                    <Td right mono>
                      {money(r.refundsPaise)}
                    </Td>
                    <Td right mono>
                      {money(r.commissionPaise)}
                    </Td>
                    <Td right mono strong>
                      {money(r.vendorSharePaise)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-admin-border px-4 py-2 text-[11px] text-admin-muted">
          Sales are tickets + food before fees; convenience fees and their GST belong to ShowBuzz. Cancelled bookings
          count in sales and refunds but earn no share; cancellation fees on online bookings stay with ShowBuzz.
        </p>
      </Card>

      <Payouts payouts={data.payouts} />
      {data.billingModel === "subscription" ? <Invoices data={data} /> : null}
    </>
  );
}

function Payouts({ payouts }: { payouts: PayoutRow[] }) {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-bold text-admin-dark">Payouts received</h2>
      {payouts.length === 0 ? (
        <p className="text-xs text-admin-muted">
          No payouts yet. ShowBuzz pays your share to your bank account in settlement cycles; each one appears here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <p className="mb-2 text-[11px] text-admin-muted">
            A payout covers shows that have already taken place. Counter sales are already in your hands, so only their
            commission is deducted; a booking cancelled after an earlier payout is adjusted in the next one.
          </p>
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <Th>Settlement</Th>
                <Th>Cycle</Th>
                <Th right>Gross</Th>
                <Th right>Commission</Th>
                <Th right>Collected at counter</Th>
                <Th right>Cancellations</Th>
                <Th right>Net payout</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <Td mono>{p.code}</Td>
                  <Td>
                    {formatDateShort(new Date(p.periodFrom))} – {formatDateShort(new Date(p.periodTo))}
                  </Td>
                  <Td right mono>
                    {money(p.grossSalesPaise)}
                  </Td>
                  <Td right mono>
                    {money(p.commissionPaise)}
                  </Td>
                  <Td right mono>
                    {money(p.counterCollectedPaise)}
                  </Td>
                  <Td right mono>
                    {money(p.refundsPaise)}
                  </Td>
                  <Td right mono strong>
                    {p.netPayoutPaise < 0 ? `You owe ${money(-p.netPayoutPaise)}` : money(p.netPayoutPaise)}
                  </Td>
                  <Td>
                    <StatusBadge tone={p.status === "paid" ? "success" : "warning"}>
                      {p.status === "paid" ? "Paid" : "Pending"}
                    </StatusBadge>
                    {p.reference ? (
                      <span className="block text-[10px] text-admin-subtle">Ref {p.reference}</span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function invoiceBadge(i: InvoiceRow) {
  if (i.status === "paid") return <StatusBadge tone="success">Paid</StatusBadge>;
  if (i.status === "void") return <StatusBadge tone="neutral">Void</StatusBadge>;
  return i.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : <StatusBadge tone="warning">Due</StatusBadge>;
}

function Invoices({ data }: { data: VendorEarnings }) {
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-bold text-admin-dark">Subscription</h2>
        <p className="text-xs text-admin-muted">
          {data.planName
            ? `${data.planName}: ${money(data.planFeePaise ?? 0)} a month. ShowBuzz takes no commission on your sales.`
            : "No plan assigned yet. ShowBuzz will set your plan."}
        </p>
      </div>
      {data.invoices.length === 0 ? (
        <p className="text-xs text-admin-muted">
          No invoices yet. Monthly invoices appear here when ShowBuzz issues them.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <Th>Invoice</Th>
                <Th>Month</Th>
                <Th>Plan</Th>
                <Th right>Amount</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <Td mono>{i.code}</Td>
                  <Td>{i.month}</Td>
                  <Td>{i.planName}</Td>
                  <Td right mono>
                    {money(i.amountPaise)}
                  </Td>
                  <Td>{formatDateShort(new Date(i.dueAt))}</Td>
                  <Td>
                    {invoiceBadge(i)}
                    {i.paidAt ? (
                      <span className="block text-[10px] text-admin-subtle">
                        Paid {formatDateShort(new Date(i.paidAt))}
                        {i.reference ? ` · ${i.reference}` : ""}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DateInput({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-admin-muted">{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="rounded-md border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text"
      />
    </label>
  );
}

function Kpi({ label, value, hint, strong = false }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <Card className={cn("space-y-1 p-4", strong && "border-admin-indigo/40 bg-admin-active")}>
      <p className="text-[11px] font-bold tracking-wider text-admin-subtle uppercase">{label}</p>
      <p className={cn("font-mono text-lg font-black", strong ? "text-admin-indigo" : "text-admin-dark")}>{value}</p>
      <p className="text-[11px] text-admin-muted">{hint}</p>
    </Card>
  );
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th className={cn("px-4 py-2.5 font-semibold", right && "text-right")}>{children}</th>;
}

function Td({
  children,
  right = false,
  mono = false,
  strong = false,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={cn("px-4 py-2.5", right && "text-right", mono && "font-mono", strong && "font-bold text-admin-dark")}
    >
      {children}
    </td>
  );
}
