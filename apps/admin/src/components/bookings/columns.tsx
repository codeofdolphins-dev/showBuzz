import Link from "next/link";
import type { DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import type { AdminBookingRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { methodLabel } from "@/components/billing/ProviderBadge";

/** Booking status with "Checked in" for confirmed tickets scanned at the gate. */
export function BookingStatus({ row }: { row: Pick<AdminBookingRow, "status" | "checkedInAt"> }) {
  if (row.status === "confirmed" && row.checkedInAt) return <StatusBadge tone="indigo">Checked in</StatusBadge>;
  return <StatusBadge status={row.status} />;
}

/** Prototype bookings.html columns, shared by the bookings list and a customer's bookings. */
export const BOOKING_COLUMNS: DataTableColumn<AdminBookingRow>[] = [
  {
    key: "code",
    header: "Booking ID",
    sortField: "bookedAt",
    cell: (b) => (
      <span>
        <Link href={`/bookings/${b.code}`} className="font-mono font-bold text-admin-dark hover:text-admin-indigo">
          {b.code}
        </Link>
        <span className="block text-[10px] text-admin-subtle">
          {formatDateShort(new Date(b.bookedAt))}, {formatTime(new Date(b.bookedAt))}
        </span>
      </span>
    ),
  },
  {
    key: "customer",
    header: "Customer & phone",
    cell: (b) => (
      <span>
        {b.customerId ? (
          <Link href={`/customers/${b.customerId}`} className="block font-semibold hover:text-admin-indigo">
            {b.customerName ?? "Customer"}
          </Link>
        ) : (
          <span className="block font-semibold">{b.customerName ?? "Walk-in"}</span>
        )}
        <span className="block text-[11px] text-admin-subtle">{b.customerPhone ?? b.customerEmail ?? "—"}</span>
      </span>
    ),
  },
  {
    key: "content",
    header: "Content & venue",
    cell: (b) => (
      <span className="block max-w-56">
        <span className="block truncate font-semibold">{b.title}</span>
        <span className="block truncate text-[11px] text-admin-subtle">
          {b.venueName}
          {b.vendorName ? ` · ${b.vendorName}` : ""}
        </span>
      </span>
    ),
  },
  {
    key: "show",
    header: "Show date & seats",
    sortField: "startsAt",
    cell: (b) => (
      <span>
        <span className="block">{b.scheduleLabel}</span>
        <span className="block text-[11px] text-admin-subtle">
          {b.seatLabels.length ? b.seatLabels.join(", ") : `${b.ticketCount} ticket(s)`}
        </span>
      </span>
    ),
  },
  {
    key: "payment",
    header: "Payment & method",
    sortField: "total",
    className: "text-right",
    cell: (b) => (
      <span>
        <span className="block font-mono font-bold">{formatINR(b.totalPaise)}</span>
        <span className="block text-[10px] text-admin-subtle">
          {methodLabel(b.paymentMethod)}
          {b.channel === "counter" ? " · counter" : ""}
        </span>
      </span>
    ),
  },
  { key: "status", header: "Status", cell: (b) => <BookingStatus row={b} /> },
];
