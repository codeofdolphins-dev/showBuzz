import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, IndianRupee, Landmark, Store, Ticket } from "lucide-react";
import { BarList, KpiCard, RangeTabs, SectionTitle, TrendChart } from "@showbuzz/console-ui/DashboardParts";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getAdminDashboard } from "@showbuzz/core/services/admin/dashboard.service";
import { DASHBOARD_RANGE_LABELS, DASHBOARD_RANGES, dashboardRangeSchema } from "@showbuzz/schemas/dashboard";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminDashboard, SalesSlice } from "@showbuzz/schemas/types/dashboard";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Dashboard" };

const money = (paise: number) => formatINR(paise);
const count = (n: number) => n.toLocaleString("en-IN");
const RANGE_OPTIONS = DASHBOARD_RANGES.map((value) => ({ value, label: DASHBOARD_RANGE_LABELS[value] }));

/**
 * Prototype dashboard.html with live figures from MongoDB (getAdminDashboard: cached 2 minutes). Sales figures are
 * shown to staff who may read bookings or reports; everyone else sees the welcome line only.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { staff } = await requireStaffPage("/dashboard");
  const sp = await searchParams;
  const range = dashboardRangeSchema.catch("7d").parse(param(sp, "range"));
  const canSee = ["bookings:read", "reports:read"].some((p) => hasPermission(staff.permissions, p));
  const result = canSee ? await load(() => getAdminDashboard(range, new Date())) : null;

  return (
    <>
      <PageHeader
        title="Box Office & Operations Dashboard"
        subtitle={`Welcome back, ${staff.name.split(" ")[0]}. Sales, platform revenue and vendors across ShowBuzz (IST).`}
        actions={
          canSee ? (
            <RangeTabs current={range} options={RANGE_OPTIONS} hrefFor={(value) => `/dashboard?range=${value}`} />
          ) : null
        }
      />
      {result === null ? (
        <Card className="p-6 text-xs text-admin-muted">
          Use the menu to open the screens your role includes. Sales figures need the Bookings or Reports permission.
        </Card>
      ) : !result.ok ? (
        <TableError message="Dashboard figures couldn't be loaded. Refresh to try again." />
      ) : (
        <Figures data={result.data} canOpenBookings={hasPermission(staff.permissions, "bookings:read")} />
      )}
    </>
  );
}

function Figures({ data, canOpenBookings }: { data: AdminDashboard; canOpenBookings: boolean }) {
  const { kpis } = data;
  const r = kpis.revenue;
  const slices = (items: SalesSlice[], hrefFor?: (key: string) => string) =>
    items.map((i) => ({
      ...(hrefFor ? { href: hrefFor(i.key) } : {}),
      key: i.key,
      label: i.label,
      ...(i.detail ? { detail: i.detail } : {}),
      value: i.salesPaise,
      display: money(i.salesPaise),
      extra: `${count(i.tickets)} tickets`,
    }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Gross sales"
          value={money(kpis.grossSalesPaise)}
          icon={<IndianRupee className="h-4 w-4" />}
          tone="bg-indigo-50 text-admin-indigo"
          current={kpis.grossSalesPaise}
          previous={kpis.previousGrossSalesPaise}
          note={`${count(kpis.bookings)} orders · refunds ${money(kpis.refundsPaise)}`}
        />
        <KpiCard
          label="Platform revenue"
          value={money(kpis.platformRevenuePaise)}
          icon={<Landmark className="h-4 w-4" />}
          tone="bg-teal-50 text-admin-teal"
          current={kpis.platformRevenuePaise}
          previous={kpis.previousPlatformRevenuePaise}
          note={`Fees ${money(r.convenienceFeePaise)} · commission ${money(r.commissionPaise)} · subscriptions ${money(r.subscriptionPaise)}${r.cancellationFeesPaise ? ` · cancellation fees ${money(r.cancellationFeesPaise)}` : ""}`}
        />
        <KpiCard
          label="Tickets sold"
          value={count(kpis.tickets)}
          icon={<Ticket className="h-4 w-4" />}
          tone="bg-rose-50 text-admin-coral"
          current={kpis.tickets}
          previous={kpis.previousTickets}
          note="Bookings still confirmed"
        />
        <KpiCard
          label="Active vendors"
          value={count(kpis.activeVendors)}
          icon={<Store className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-700"
          note="Active and onboarded (live on ShowBuzz)"
        />
        <KpiCard
          label="New vendors"
          value={count(kpis.newVendors)}
          icon={<Building2 className="h-4 w-4" />}
          tone="bg-purple-50 text-purple-700"
          current={kpis.newVendors}
          previous={kpis.previousNewVendors}
          note={
            kpis.giftCardsSold
              ? `Gift cards sold: ${kpis.giftCardsSold} (${money(kpis.giftCardSalesPaise)})`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <SectionTitle
            title="Ticket sales trend"
            subtitle={`Gross sales per ${data.range === "today" ? "hour" : "day"}, ${formatRange(data)}`}
          />
          <TrendChart
            caption="Gross sales over the period"
            bars={data.trend.map((t) => ({
              key: t.key,
              label: t.label,
              value: t.salesPaise,
              display: `${money(t.salesPaise)} · ${count(t.tickets)} tickets`,
            }))}
          />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Sales by category" subtitle="Gross sales" />
          <BarList items={slices(data.categories)} empty="No sales in this period." />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Top vendors" subtitle="By gross sales" />
          <BarList items={slices(data.topVendors, (id) => `/vendors/${id}`)} empty="No sales in this period." />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Top movies & events" subtitle="By gross sales" />
          <BarList items={slices(data.topTitles)} empty="No sales in this period." />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Sales by city" subtitle="Where the shows took place" />
          <BarList items={slices(data.cities)} empty="No sales in this period." />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-admin-border bg-slate-50/50 p-4">
          <SectionTitle
            title="Recent bookings"
            subtitle="Latest sales across every vendor, online and at the counter"
          />
          {canOpenBookings ? (
            <Link
              href="/bookings"
              className="flex items-center gap-1 text-xs font-bold text-admin-indigo hover:underline"
            >
              View all <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Recent bookings</caption>
            <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-bold">Booking</th>
                <th className="px-4 py-2.5 font-bold">Customer</th>
                <th className="px-4 py-2.5 font-bold">Show / venue</th>
                <th className="px-4 py-2.5 font-bold">Showtime</th>
                <th className="px-4 py-2.5 text-right font-bold">Total</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-admin-muted">
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                data.recent.map((b) => (
                  <tr key={b.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                      {canOpenBookings ? (
                        <Link href={`/bookings/${b.code}`} className="text-admin-indigo hover:underline">
                          {b.code}
                        </Link>
                      ) : (
                        b.code
                      )}
                      <span className="block font-sans text-[10px] font-normal text-admin-subtle">
                        {formatDateShort(new Date(b.bookedAt))}, {formatTime(new Date(b.bookedAt))}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-admin-dark">
                      {b.customer}
                      {b.channel === "counter" ? (
                        <span className="block text-[10px] font-normal text-admin-subtle">Counter sale</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-admin-muted">
                      <span className="font-semibold text-admin-dark">{b.title}</span>
                      <span className="block text-[10px]">
                        {b.venueName}
                        {b.vendorName ? ` · ${b.vendorName}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-admin-muted">{b.scheduleLabel}</td>
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
        Figures as of {formatTime(new Date(data.generatedAt))} IST (refreshed every 2 minutes). Gross sales include fees
        and GST, after discounts, for bookings paid in the period; platform revenue counts fees (without GST) and
        commission on bookings still confirmed, cancellation fees kept, and subscription invoices paid in the period.
      </p>
    </>
  );
}

function formatRange(data: AdminDashboard): string {
  return data.fromKey === data.toKey ? "today" : `${data.fromKey} to ${data.toKey}`;
}
