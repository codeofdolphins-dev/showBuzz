import type { Metadata } from "next";
import { BarList, KpiCard, RangeTabs, SectionTitle, TrendChart } from "@showbuzz/console-ui/DashboardParts";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getAudienceAnalytics } from "@showbuzz/core/services/admin/analytics-admin.service";
import { ANALYTICS_RANGES, analyticsRangeSchema } from "@showbuzz/schemas/admin-catalog";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AudienceAnalytics } from "@showbuzz/schemas/types/admin-catalog";
import { formatTime } from "@showbuzz/utils/dates";
import { cn } from "@showbuzz/utils/cn";
import { Gauge, Repeat, ShoppingBag, Ticket, Users } from "lucide-react";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Audience Analytics" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const count = (n: number) => n.toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");

/** Prototype analytics.html: when, on what and how far ahead people book, and who comes back. */
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { staff } = await requireStaffPage("/analytics");
  if (!hasPermission(staff.permissions, "analytics:read")) return <NoAccess title="Audience Analytics" />;
  const sp = await searchParams;
  const range = analyticsRangeSchema.catch("30d").parse(param(sp, "range"));
  const result = await load(() => getAudienceAnalytics(range, new Date()));

  return (
    <>
      <PageHeader
        title="Audience & Hourly Traffic Analytics"
        crumb="Analytics"
        subtitle="Ticket bookings across every vendor, by the IST time they were paid for."
        actions={
          <RangeTabs
            current={range}
            options={ANALYTICS_RANGES.map((value) => ({ value, label: `Last ${value.replace("d", "")} days` }))}
            hrefFor={(value) => `/analytics?range=${value}`}
          />
        }
      />
      {result.ok ? <Figures data={result.data} /> : <TableError message="Analytics couldn't be loaded. Try again." />}
    </>
  );
}

function Figures({ data }: { data: AudienceAnalytics }) {
  const max = Math.max(1, ...data.heatmap.flat());
  const peakHour = data.byHour.reduce((best, n, h) => (n > (data.byHour[best] ?? 0) ? h : best), 0);
  const toList = (items: { key: string; label: string; bookings: number }[]) =>
    items.map((i) => ({
      key: i.key,
      label: i.label,
      value: i.bookings,
      display: count(i.bookings),
      extra: pct(i.bookings, data.bookings),
    }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Bookings"
          value={count(data.bookings)}
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="bg-indigo-50 text-admin-indigo"
          note={`${data.fromKey} to ${data.toKey}`}
        />
        <KpiCard
          label="Customers"
          value={count(data.customers.total)}
          icon={<Users className="h-4 w-4" />}
          tone="bg-teal-50 text-admin-teal"
          note={`${count(data.customers.new)} new this period`}
        />
        <KpiCard
          label="Returning"
          value={pct(data.customers.returning, data.customers.total)}
          icon={<Repeat className="h-4 w-4" />}
          tone="bg-emerald-50 text-admin-success"
          note={`${count(data.customers.returning)} had booked before`}
        />
        <KpiCard
          label="Tickets per order"
          value={data.avgTicketsPerOrder.toFixed(1)}
          icon={<Ticket className="h-4 w-4" />}
          tone="bg-rose-50 text-admin-coral"
        />
        <KpiCard
          label="Cancelled"
          value={`${(data.cancellationRateBps / 100).toFixed(1)}%`}
          icon={<Gauge className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-700"
          note="Of bookings paid in the period"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <SectionTitle
            title="Hourly booking velocity"
            subtitle={
              data.bookings
                ? `Peak booking time: ${String(peakHour).padStart(2, "0")}:00–${String(peakHour + 1).padStart(2, "0")}:00 IST`
                : "Bookings per hour of the day (IST)"
            }
          />
          <TrendChart
            caption="Bookings by hour of the day"
            bars={data.byHour.map((n, h) => ({
              key: String(h),
              label: `${String(h).padStart(2, "0")}:00`,
              value: n,
              display: `${count(n)} bookings`,
            }))}
          />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Device breakdown" subtitle="Online orders by device; counter sales separately" />
          <BarList items={toList(data.devices)} empty="No bookings in this period." />
        </Card>
      </div>

      <Card className="space-y-4 overflow-hidden p-4 sm:p-5">
        <SectionTitle title="When people book" subtitle="Bookings by weekday and hour (IST); darker = more" />
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-[10px]">
            <caption className="sr-only">Bookings by weekday and hour</caption>
            <thead>
              <tr>
                <th className="sr-only">Day</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} scope="col" className="w-6 font-normal text-admin-subtle">
                    {h % 3 === 0 ? String(h).padStart(2, "0") : <span className="sr-only">{h}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.heatmap.map((row, d) => (
                <tr key={WEEKDAYS[d]}>
                  <th scope="row" className="pr-2 text-left font-semibold text-admin-muted">
                    {WEEKDAYS[d]}
                  </th>
                  {row.map((n, h) => (
                    <td
                      key={h}
                      title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 · ${n} bookings`}
                      className={cn("h-6 w-6 rounded-[3px]", n === 0 && "bg-slate-100")}
                      style={n > 0 ? { backgroundColor: `rgb(79 70 229 / ${0.15 + (n / max) * 0.85})` } : undefined}
                    >
                      <span className="sr-only">{n}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="How far ahead people book" subtitle="Time between payment and the show" />
          <BarList items={toList(data.leadTime)} empty="No bookings in this period." />
        </Card>
        <Card className="space-y-4 p-4 sm:p-5">
          <SectionTitle title="Sales channel" subtitle="Online vs box office counter" />
          <BarList items={toList(data.channels)} empty="No bookings in this period." />
        </Card>
      </div>
      <p className="text-[10px] text-admin-subtle">
        Figures as of {formatTime(new Date(data.generatedAt))} IST (refreshed every 5 minutes). Devices are recorded on
        online orders from this release on; older orders show as Unknown. Gift card purchases are not included.
      </p>
    </>
  );
}
