import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  ChevronRight,
  Gauge,
  IndianRupee,
  Landmark,
  RotateCcw,
  ScanLine,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  BarList,
  KpiCard,
  OccupancyMeter,
  RangeTabs,
  SectionTitle,
  TrendChart,
} from "@showbuzz/console-ui/DashboardParts";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getPlanSummary } from "@showbuzz/core/services/partner/account.service";
import { getPartnerDashboard } from "@showbuzz/core/services/partner/dashboard.service";
import { DASHBOARD_RANGE_LABELS, DASHBOARD_RANGES, dashboardRangeSchema } from "@showbuzz/schemas/dashboard";
import type { PartnerDashboard, ShowOccupancy } from "@showbuzz/schemas/types/dashboard";
import { VENDOR_BUSINESS_TYPE_LABELS, describeCutoff } from "@showbuzz/schemas/vendor";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Dashboard" };

const percent = (bps: number) => `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
const money = (paise: number) => formatINR(paise);
const count = (n: number) => n.toLocaleString("en-IN");
const RANGE_OPTIONS = DASHBOARD_RANGES.map((value) => ({ value, label: DASHBOARD_RANGE_LABELS[value] }));

/**
 * The vendor's home: sales, tickets and occupancy for today / 7 / 30 days, upcoming shows and the latest bookings
 * (getPartnerDashboard, scoped to the session's vendor, cached one minute), then the money terms ShowBuzz applies.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { vendorUser, vendor } = await requireVendorPage("/dashboard");
  const sp = await searchParams;
  const range = dashboardRangeSchema.catch("7d").parse(param(sp, "range"));
  const [plan, result] = await Promise.all([
    vendor.billingModel === "subscription" ? getPlanSummary(vendor.planId) : null,
    load(() => getPartnerDashboard(vendor.id, range, new Date())),
  ]);

  return (
    <>
      <PageHeader
        title={vendor.businessName}
        subtitle={`Welcome back, ${vendorUser.name.split(" ")[0]}. ${VENDOR_BUSINESS_TYPE_LABELS[vendor.businessType]} on ShowBuzz.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={vendor.status} />
            <RangeTabs current={range} options={RANGE_OPTIONS} hrefFor={(value) => `/dashboard?range=${value}`} />
          </div>
        }
      />

      {result.ok ? (
        <Figures data={result.data} commission={vendor.billingModel === "commission"} />
      ) : (
        <TableError message="Your figures couldn't be loaded. Refresh to try again." />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5">
          <CardTitle icon={BadgeIndianRupee} title="Billing" subtitle="Set by ShowBuzz for your account" />
          <dl className="space-y-2.5 text-xs">
            <Term label="Billing model">
              {vendor.billingModel === "commission" ? "Commission on sales" : "Monthly subscription"}
            </Term>
            {vendor.billingModel === "commission" ? (
              <Term label="Commission">{percent(vendor.commissionBps)} of ticket + food sales (after discounts)</Term>
            ) : (
              <Term label="Plan">
                {plan ? `${plan.name} · ${formatINR(plan.monthlyFeePaise)} / month` : "Plan to be assigned by ShowBuzz"}
              </Term>
            )}
            <Term label="Convenience fee">
              {percent(vendor.convenienceFeeBps)} charged to customers (kept by ShowBuzz)
            </Term>
            <Term label="GST on fee">{percent(vendor.gstBps)}</Term>
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <CardTitle icon={RotateCcw} title="Cancellation policy" subtitle="Shown to customers on your shows" />
          <dl className="space-y-2.5 text-xs">
            <Term label="Cancellations">{vendor.cancellation.allowed ? "Allowed" : "Not allowed"}</Term>
            {vendor.cancellation.allowed ? (
              <>
                <Term label="Cutoff">{describeCutoff(vendor.cancellation.cutoffMinutes)}</Term>
                <Term label="Fee">{formatINR(vendor.cancellation.feePaise)} per booking</Term>
              </>
            ) : null}
          </dl>
          <Link href="/cancellation-policy" className="text-[11px] font-semibold text-admin-indigo hover:underline">
            Edit cancellation policy
          </Link>
        </Card>

        <Card className="space-y-4 p-5">
          <CardTitle icon={Landmark} title="KYC & payouts" subtitle="Verified during onboarding" />
          <dl className="space-y-2.5 text-xs">
            <Term label="GSTIN">
              <span className="font-mono">{vendor.kyc.gstin || "—"}</span>
            </Term>
            <Term label="PAN">
              <span className="font-mono">{vendor.kyc.pan || "—"}</span>
            </Term>
            <Term label="Payout account">
              <span className="font-mono">
                {vendor.kyc.bankAccount.accountNumberMasked || "—"} · {vendor.kyc.bankAccount.ifsc || "—"}
              </span>
            </Term>
          </dl>
        </Card>
      </div>
    </>
  );
}

function Figures({ data, commission }: { data: PartnerDashboard; commission: boolean }) {
  const { kpis } = data;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Sales"
          value={money(kpis.salesPaise)}
          icon={<IndianRupee className="h-4 w-4" />}
          tone="bg-indigo-50 text-admin-indigo"
          current={kpis.salesPaise}
          previous={kpis.previousSalesPaise}
          note={`${count(kpis.bookings)} bookings · ${count(kpis.counterBookings)} at the counter`}
        />
        <KpiCard
          label="Your share"
          value={money(kpis.vendorSharePaise)}
          icon={<Wallet className="h-4 w-4" />}
          tone="bg-emerald-50 text-admin-success"
          note={commission ? "After ShowBuzz commission" : "Subscription: no commission"}
        />
        <KpiCard
          label="Tickets sold"
          value={count(kpis.tickets)}
          icon={<Ticket className="h-4 w-4" />}
          tone="bg-rose-50 text-admin-coral"
          current={kpis.tickets}
          previous={kpis.previousTickets}
          note={kpis.refundsPaise ? `Refunds ${money(kpis.refundsPaise)}` : "Bookings still confirmed"}
        />
        <KpiCard
          label="Occupancy"
          value={kpis.occupancyBps === null ? "—" : `${(kpis.occupancyBps / 100).toFixed(1)}%`}
          icon={<Gauge className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-700"
          note={`${count(kpis.showsRun)} shows started in the period`}
        />
        <KpiCard
          label="Checked in"
          value={count(kpis.checkedIn)}
          icon={<ScanLine className="h-4 w-4" />}
          tone="bg-teal-50 text-admin-teal"
          note="Bookings admitted at the gate"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <SectionTitle
            title="Sales trend"
            subtitle={`Tickets + food per ${data.range === "today" ? "hour" : "day"} (IST)`}
          />
          <TrendChart
            caption="Sales over the period"
            bars={data.trend.map((t) => ({
              key: t.key,
              label: t.label,
              value: t.salesPaise,
              display: `${money(t.salesPaise)} · ${count(t.tickets)} tickets`,
            }))}
          />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Top movies & events" subtitle="By sales" />
          <BarList
            items={data.topTitles.map((t) => ({
              key: t.key,
              label: t.label,
              ...(t.detail ? { detail: t.detail } : {}),
              value: t.salesPaise,
              display: money(t.salesPaise),
              extra: `${count(t.tickets)} tickets`,
            }))}
            empty="No sales in this period."
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ShowTable
          title="Upcoming shows"
          subtitle="Next 7 days: seats or passes sold so far"
          shows={data.upcoming}
          empty="No shows in the next 7 days."
          action={
            <Link href="/shows" className="flex items-center gap-1 text-xs font-bold text-admin-indigo hover:underline">
              All shows <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <ShowTable
          title="Occupancy per show"
          subtitle="Latest shows that started in the period"
          shows={data.pastShows}
          empty="No shows started in this period."
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-admin-border bg-slate-50/50 p-4">
          <SectionTitle title="Recent bookings" subtitle="Online and counter sales" />
          <Link
            href="/bookings"
            className="flex items-center gap-1 text-xs font-bold text-admin-indigo hover:underline"
          >
            View all <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Recent bookings</caption>
            <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-bold">Booking</th>
                <th className="px-4 py-2.5 font-bold">Show</th>
                <th className="px-4 py-2.5 font-bold">Seats / tickets</th>
                <th className="px-4 py-2.5 text-right font-bold">Amount</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-admin-muted">
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                data.recent.map((b) => (
                  <tr key={b.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                      <Link href={`/bookings/${b.code}`} className="text-admin-indigo hover:underline">
                        {b.code}
                      </Link>
                      <span className="block font-sans text-[10px] font-normal text-admin-subtle">
                        {b.channel === "counter" ? "Counter · " : ""}
                        {formatDateShort(new Date(b.bookedAt))}, {formatTime(new Date(b.bookedAt))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-admin-muted">
                      <span className="font-semibold text-admin-dark">{b.title}</span>
                      <span className="block text-[10px]">
                        {b.venueName} · {b.scheduleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-admin-muted">
                      {b.seats} <span className="text-[10px] text-admin-subtle">({b.ticketCount})</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-admin-dark">
                      {formatINR(b.totalPaise, { exact: true })}
                    </td>
                    <td className="px-4 py-3">
                      {b.checkedIn ? (
                        <StatusBadge tone="info">Checked in</StatusBadge>
                      ) : (
                        <StatusBadge status={b.status} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[10px] text-admin-subtle">
        Figures as of {formatTime(new Date(data.generatedAt))} IST, refreshed every minute. Sales are tickets + food
        (before fees) of bookings paid in the period, including ones cancelled later; your share counts bookings still
        confirmed. Detailed figures are in Earnings and Reports.
      </p>
    </>
  );
}

function ShowTable({
  title,
  subtitle,
  shows,
  empty,
  action,
}: {
  title: string;
  subtitle: string;
  shows: ShowOccupancy[];
  empty: string;
  action?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-admin-border bg-slate-50/50 p-4">
        <SectionTitle title={title} subtitle={subtitle} action={action} />
      </div>
      {shows.length === 0 ? (
        <p className="p-6 text-center text-xs text-admin-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shows.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-1 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-admin-dark">{s.title}</p>
                <p className="text-[10px] text-admin-subtle">
                  {s.startsAt ? `${formatDateShort(new Date(s.startsAt))}, ${formatTime(new Date(s.startsAt))} · ` : ""}
                  {s.venueName}
                  {s.kind === "seated" ? ` · ${s.screenName}` : " · passes"}
                </p>
              </div>
              <OccupancyMeter sold={s.sold} capacity={s.capacity} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CardTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof BadgeIndianRupee;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-admin-active text-admin-indigo">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h2 className="text-sm font-bold text-admin-dark">{title}</h2>
        <p className="text-[11px] text-admin-subtle">{subtitle}</p>
      </div>
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}
