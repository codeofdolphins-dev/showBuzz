import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus, QrCode } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { BOOKING_SORT_FIELDS, listVendorBookings } from "@showbuzz/core/services/partner/booking.service";
import { bookingListStatusSchema } from "@showbuzz/schemas/partner-box-office";
import type { VendorBookingRow } from "@showbuzz/schemas/types/partner-box-office";
import { formatDateShort, formatTime, isDateKey } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { PAYMENT_METHOD_LABELS } from "@showbuzz/utils/payment";
import { BookingStatusBadge } from "@/components/bookings/BookingStatusBadge";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Bookings" };

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "cancelled", label: "Cancelled" },
];
const CHANNEL_OPTIONS = [
  { value: "online", label: "Online (showbuzz.com)" },
  { value: "counter", label: "Box office counter" },
];

function columns(sharesContact: boolean): DataTableColumn<VendorBookingRow>[] {
  return [
    {
      key: "code",
      header: "Booking ID",
      cell: (b) => (
        <Link href={`/bookings/${b.code}`} className="hover:text-admin-indigo">
          <span className="block font-mono font-bold text-admin-dark">{b.code}</span>
          <span className="block text-[11px] text-admin-subtle">{b.channel === "counter" ? "Counter" : "Online"}</span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (b) =>
        b.contact?.name || b.contact?.phone ? (
          <>
            <span className="block font-semibold">{b.contact.name ?? "Walk-in"}</span>
            <span className="block text-[11px] text-admin-subtle">{b.contact.phone ?? b.contact.email ?? ""}</span>
          </>
        ) : (
          <span className="text-[11px] text-admin-subtle">
            {b.channel === "counter" ? "Walk-in" : sharesContact ? "—" : "Hidden"}
          </span>
        ),
    },
    {
      key: "title",
      header: "Content & venue",
      cell: (b) => (
        <>
          <span className="block font-bold text-admin-dark">{b.title}</span>
          <span className="block text-[11px] text-admin-subtle">
            {b.venueName}
            {b.screenName ? ` · ${b.screenName}` : ""}
          </span>
        </>
      ),
    },
    {
      key: "startsAt",
      header: "Show & seats",
      sortField: "startsAt",
      cell: (b) => (
        <>
          <span className="block font-semibold">
            {b.startsAt
              ? `${formatDateShort(new Date(b.startsAt))}, ${formatTime(new Date(b.startsAt))}`
              : b.scheduleLabel}
          </span>
          <span className="block max-w-48 truncate text-[11px] text-admin-subtle" title={b.seatLabels.join(", ")}>
            {b.seatLabels.join(", ")}
          </span>
        </>
      ),
    },
    {
      key: "total",
      header: "Amount & payment",
      sortField: "total",
      cell: (b) => (
        <>
          <span className="block font-mono font-bold text-admin-dark">{formatINR(b.totalPaise, { exact: true })}</span>
          <span className="block text-[11px] text-admin-subtle">{PAYMENT_METHOD_LABELS[b.paymentMethod]}</span>
        </>
      ),
    },
    {
      key: "bookedAt",
      header: "Booked",
      sortField: "bookedAt",
      cell: (b) => (
        <span className="text-[11px]">
          {formatDateShort(new Date(b.bookedAt))}, {formatTime(new Date(b.bookedAt))}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (b) => <BookingStatusBadge booking={b} /> },
  ];
}

/**
 * Prototype bookings.html ("Box Office Bookings & Orders CRM"): the vendor's confirmed and cancelled bookings, online
 * and at the counter, with check-in state. Customer contact shows only when ShowBuzz shares it with this vendor.
 */
export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const { vendor } = await requireVendorPage("/bookings");
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: BOOKING_SORT_FIELDS,
    defaultSort: { field: "bookedAt", direction: "desc" },
  });
  const status = bookingListStatusSchema.safeParse(param(sp, "status"));
  const channelParam = param(sp, "channel");
  const channel = channelParam === "online" || channelParam === "counter" ? channelParam : undefined;
  const dateParam = param(sp, "date") ?? "";
  const dateKey = isDateKey(dateParam) ? dateParam : undefined;
  const showId = param(sp, "show") || undefined;

  const result = await load(() =>
    listVendorBookings(vendor.id, {
      ...params,
      ...(status.success ? { status: status.data } : {}),
      ...(channel ? { channel } : {}),
      ...(dateKey ? { dateKey } : {}),
      ...(showId ? { showId } : {}),
    }),
  );
  const filtered = Boolean(params.q || status.success || channel || dateKey || showId);

  return (
    <>
      <PageHeader
        title="Bookings"
        crumb="Bookings"
        subtitle="Ticket sales for your shows, online and at your counters, with gate check-in."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/scan-tickets" variant="secondary">
              <QrCode className="h-4 w-4" aria-hidden /> Scan tickets
            </LinkButton>
            <LinkButton href="/bookings/new">
              <Plus className="h-4 w-4" aria-hidden /> Counter booking
            </LinkButton>
          </div>
        }
      />
      {result.ok && !result.data.sharesContact ? (
        <p className="rounded-lg border border-admin-border bg-slate-50 px-3 py-2 text-[11px] text-admin-muted">
          Customer names and contact details of online bookings are hidden. ShowBuzz can share them with you on request.
        </p>
      ) : null}
      <FilterBar
        searchPlaceholder="Search booking ID, title or seat…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS, allLabel: "All statuses" },
          { name: "channel", label: "Sold", options: CHANNEL_OPTIONS, allLabel: "Online & counter" },
        ]}
        actions={
          <DateFilter
            value={dateKey ?? ""}
            keep={{ q: params.q, status: param(sp, "status"), channel: channelParam, show: showId }}
          />
        }
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={columns(result.data.sharesContact)}
          rows={result.data.rows}
          rowKey={(b) => b.code}
          total={result.data.total}
          params={params}
          pathname="/bookings"
          searchParams={sp}
          caption="Your bookings"
          rowActions={(b) => (
            <Link
              href={`/bookings/${b.code}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open booking ${b.code}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={
            <EmptyState
              title={filtered ? "No bookings match" : "No bookings yet"}
              description={
                filtered ? "Try another filter or search." : "Tickets sold online and at your counters appear here."
              }
            />
          }
        />
      )}
    </>
  );
}

/** Show date filter (IST): a plain GET form that keeps the other filters, so it works like them (URL params). */
function DateFilter({ value, keep }: { value: string; keep: Record<string, string | undefined> }) {
  return (
    <form method="get" className="flex items-center gap-2" aria-label="Filter by show date">
      {Object.entries(keep).map(([name, v]) => (v ? <input key={name} type="hidden" name={name} value={v} /> : null))}
      <label className="sr-only" htmlFor="booking-date">
        Show date
      </label>
      <input
        id="booking-date"
        type="date"
        name="date"
        defaultValue={value}
        className="rounded-md border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text"
      />
      <button
        type="submit"
        className="rounded-md border border-admin-border bg-white px-2.5 py-1.5 text-xs font-bold text-admin-text hover:bg-slate-50"
      >
        Go
      </button>
    </form>
  );
}
