import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import type { VendorBookingRow } from "@showbuzz/schemas/types/partner-box-office";

/** Confirmed / Checked in / Cancelled (prototype bookings.html badges). */
export function BookingStatusBadge({ booking }: { booking: Pick<VendorBookingRow, "status" | "checkedInAt"> }) {
  if (booking.status === "cancelled") return <StatusBadge tone="danger">Cancelled</StatusBadge>;
  if (booking.checkedInAt) return <StatusBadge tone="info">Checked in</StatusBadge>;
  return <StatusBadge tone="success">Confirmed</StatusBadge>;
}
