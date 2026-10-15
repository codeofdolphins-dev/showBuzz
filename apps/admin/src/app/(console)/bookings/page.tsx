import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ADMIN_BOOKING_SORT_FIELDS, listBookingsAdmin } from "@showbuzz/core/services/admin/booking-admin.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { adminBookingStatusSchema, bookingTypeSchema } from "@showbuzz/schemas/admin-platform";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { z } from "zod";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { BOOKING_COLUMNS } from "@/components/bookings/columns";
import { dateParam, defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Bookings CRM" };

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "cancelled", label: "Cancelled / refunded" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "expired", label: "Lapsed" },
];
const TYPE_OPTIONS = [
  { value: "movie", label: "Movies" },
  { value: "event", label: "Events, plays, sports, activities" },
  { value: "gift_card", label: "Gift card purchases" },
];
const CHANNEL_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "counter", label: "Counter" },
];
const DATE_FIELD_OPTIONS = [
  { value: "booked", label: "Booked on" },
  { value: "show", label: "Show date" },
];

/** Prototype bookings.html: every vendor's bookings, online and at the counter, plus gift card purchases. */
export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const { staff } = await requireStaffPage("/bookings");
  if (!hasPermission(staff.permissions, "bookings:read")) return <NoAccess title="Bookings CRM" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: ADMIN_BOOKING_SORT_FIELDS,
    defaultSort: { field: "bookedAt", direction: "desc" },
  });
  const [result, vendors] = await Promise.all([
    load(() =>
      listBookingsAdmin({
        ...params,
        ...defined({
          status: enumParam(sp, "status", adminBookingStatusSchema),
          type: enumParam(sp, "type", bookingTypeSchema),
          channel: enumParam(sp, "channel", z.enum(["online", "counter"])),
          vendorId: param(sp, "vendor"),
          dateField: enumParam(sp, "dates", z.enum(["show", "booked"])),
          fromDate: dateParam(sp, "from"),
          toDate: dateParam(sp, "to"),
        }),
      }),
    ),
    connect()
      .then(() => listVendorOptions())
      .catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Box Office Bookings & Orders CRM"
        crumb="Bookings CRM"
        subtitle="All vendors' bookings. Open one to see the money split, refunds and payout, or to cancel it."
      />
      <FilterBar
        searchPlaceholder="Booking code, customer name, phone or email…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS, allLabel: "All statuses" },
          { name: "type", label: "Type", options: TYPE_OPTIONS },
          { name: "channel", label: "Channel", options: CHANNEL_OPTIONS },
          { name: "vendor", label: "Vendor", options: vendors, allLabel: "All vendors" },
          { name: "dates", label: "Dates are", options: DATE_FIELD_OPTIONS, allLabel: "Booked on" },
        ]}
        actions={<DateRangeFilter />}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={BOOKING_COLUMNS}
          rows={result.data.rows}
          rowKey={(b) => b.code}
          total={result.data.total}
          params={params}
          pathname="/bookings"
          searchParams={sp}
          caption="Bookings"
          rowActions={(b) => (
            <Link
              href={`/bookings/${b.code}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${b.code}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No bookings match" description="Try another search, filter or dates." />}
        />
      )}
    </>
  );
}
