import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getBookingAdmin } from "@showbuzz/core/services/admin/booking-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { describeCutoff } from "@showbuzz/schemas/vendor";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { methodLabel } from "@/components/billing/ProviderBadge";
import { CancelBookingButton } from "@/components/bookings/CancelBookingButton";
import { BookingStatus } from "@/components/bookings/columns";

export const metadata: Metadata = { title: "Booking" };

const when = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 text-xs ${strong ? "font-bold text-admin-dark" : ""}`}>
      <span className={strong ? "" : "text-admin-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

const pct = (bps: number) => `${bps / 100}%`;

/** Prototype booking-details.html: showtime and seats, customer, payment and money split, refund; staff cancel. */
export default async function BookingPage({ params }: PageProps<"/bookings/[code]">) {
  const { code } = await params;
  const { staff } = await requireStaffPage(`/bookings/${code}`);
  if (!hasPermission(staff.permissions, "bookings:read")) return <NoAccess title="Booking" />;
  const booking = await getBookingAdmin(code, new Date());
  if (!booking) notFound();
  const a = booking.amounts;
  const s = booking.settlement;

  return (
    <>
      <PageHeader
        title={booking.title}
        crumb="Bookings CRM"
        subtitle={`${booking.code} · booked ${when(booking.bookedAt)}${booking.vendorName ? ` · sold by ${booking.vendorName}` : " · platform sale"}`}
        actions={
          booking.staffCanCancel && hasPermission(staff.permissions, "bookings:write") ? (
            <CancelBookingButton
              code={booking.code}
              totalPaise={a.totalPaise}
              feePaise={booking.policy?.feePaise ?? 0}
              withinPolicy={booking.withinPolicy}
            />
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-2 p-5">
          <h2 className="flex items-center justify-between text-sm font-bold text-admin-dark">
            Showtime & seat allocation <BookingStatus row={booking} />
          </h2>
          <Row label="Venue">
            {booking.venueName}
            {booking.screenName ? ` · ${booking.screenName}` : ""}
          </Row>
          <Row label="When">{booking.scheduleLabel}</Row>
          {booking.format || booking.language ? (
            <Row label="Format / language">{[booking.format, booking.language].filter(Boolean).join(" · ")}</Row>
          ) : null}
          <Row label="Tickets">{booking.ticketLabel}</Row>
          {booking.seatLabels.length ? <Row label="Seats">{booking.seatLabels.join(", ")}</Row> : null}
          {booking.food.length ? (
            <Row label="Food">{booking.food.map((f) => `${f.quantity} × ${f.name}`).join(", ")}</Row>
          ) : null}
          {booking.checkedInAt ? <Row label="Checked in">{when(booking.checkedInAt)}</Row> : null}
          {booking.policy ? (
            <Row label="Cancellation policy (at purchase)">
              {booking.policy.allowed
                ? `${describeCutoff(booking.policy.cutoffMinutes)} before, fee ${formatINR(booking.policy.feePaise)}`
                : "Not cancellable"}
            </Row>
          ) : null}
        </Card>

        <Card className="space-y-2 p-5">
          <h2 className="text-sm font-bold text-admin-dark">Customer information</h2>
          <Row label="Name">
            {booking.customerId ? (
              <Link href={`/customers/${booking.customerId}`} className="font-semibold text-admin-indigo hover:underline">
                {booking.customerName ?? "Customer"}
              </Link>
            ) : (
              (booking.customerName ?? "Walk-in customer")
            )}
          </Row>
          <Row label="Phone">{booking.customerPhone ?? "—"}</Row>
          <Row label="Email">{booking.customerEmail ?? "—"}</Row>
          <Row label="Channel">{booking.channel === "counter" ? "Box office counter" : "Online"}</Row>
          {booking.vendorId ? (
            <Row label="Vendor">
              <Link href={`/vendors/${booking.vendorId}`} className="font-semibold text-admin-indigo hover:underline">
                {booking.vendorName}
              </Link>
            </Row>
          ) : null}
        </Card>

        <Card className="space-y-1 p-5">
          <h2 className="mb-1 text-sm font-bold text-admin-dark">Payment & financial breakdown</h2>
          <Row label="Tickets">{formatINR(a.ticketsPaise)}</Row>
          {a.foodPaise ? <Row label="Food & beverages">{formatINR(a.foodPaise)}</Row> : null}
          {a.discountPaise ? (
            <Row label={`Discount${booking.couponCode ? ` (${booking.couponCode})` : ""}`}>−{formatINR(a.discountPaise)}</Row>
          ) : null}
          <Row label={s ? `Convenience fee (${pct(s.convenienceFeeBps)})` : "Convenience fee"}>
            {formatINR(a.convenienceFeePaise)}
          </Row>
          <Row label={s ? `GST on fee (${pct(s.gstBps)})` : "GST"}>{formatINR(a.gstPaise)}</Row>
          <Row label="Total" strong>
            {formatINR(a.totalPaise)}
          </Row>
          {a.giftCardPaise ? (
            <Row label={`Gift card${booking.giftCardLast4 ? ` ····${booking.giftCardLast4}` : ""}`}>
              −{formatINR(a.giftCardPaise)}
            </Row>
          ) : null}
          <Row label={`Paid by ${methodLabel(booking.paymentMethod)}`}>{formatINR(a.payablePaise)}</Row>
          {booking.payment ? (
            <Row label="Payment">
              <StatusBadge status={booking.payment.status} />{" "}
              <span className="text-[10px] text-admin-subtle">
                {booking.payment.provider === "simulated" ? "Simulated gateway" : "Recorded at the counter"}
                {booking.payment.reference ? ` · ref ${booking.payment.reference}` : ""}
              </span>
            </Row>
          ) : null}
          {booking.failureReason ? <Row label="Failure">{booking.failureReason}</Row> : null}
          {s ? (
            <div className="mt-3 border-t border-admin-border pt-2">
              <Row label={`Vendor billing`}>
                {s.billingModel === "commission" ? `Commission ${pct(s.commissionBps)}` : "Subscription"}
              </Row>
              <Row label="Commission (ShowBuzz)">{formatINR(s.commissionPaise)}</Row>
              <Row label="Vendor share" strong>
                {formatINR(s.vendorSharePaise)}
              </Row>
              <Row label="Payout">{booking.payoutCode ?? "Not paid out yet"}</Row>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-2 p-5">
          <h2 className="text-sm font-bold text-admin-dark">Cancellation & refund</h2>
          {booking.cancelledAt ? (
            <>
              <Row label="Cancelled">{when(booking.cancelledAt)}</Row>
              <Row label="By">
                {booking.cancelledBy === "staff"
                  ? `ShowBuzz staff${booking.cancelledByName ? ` (${booking.cancelledByName})` : ""}`
                  : booking.cancelledBy === "vendor"
                    ? "The vendor"
                    : "The customer"}
              </Row>
              {booking.cancelReason ? <Row label="Reason">{booking.cancelReason}</Row> : null}
              <Row label="Refund total" strong>
                {formatINR(booking.refundPaise ?? 0)}
              </Row>
              {booking.refund ? (
                <>
                  <Row label="To the payment method">{formatINR(booking.refund.amountPaise)}</Row>
                  {booking.refund.giftCardPaise ? (
                    <Row label="Back to the gift card">{formatINR(booking.refund.giftCardPaise)}</Row>
                  ) : null}
                  <Row label="Fee kept">{formatINR(booking.refund.feePaise)}</Row>
                  <Row label="Refund status">
                    <StatusBadge status={booking.refund.status} />
                  </Row>
                </>
              ) : null}
            </>
          ) : booking.staffCanCancel ? (
            <p className="text-xs text-admin-muted">
              {booking.withinPolicy
                ? "Inside the vendor's policy: the customer or vendor can cancel it too."
                : "Outside the vendor's policy: only the vendor or ShowBuzz staff can cancel it now, with a reason."}
            </p>
          ) : (
            <p className="text-xs text-admin-muted">
              {booking.kind === "gift-card"
                ? "A gift card purchase: cancel the card from Gift cards (an unused card is refunded)."
                : "Not cancellable now (not confirmed, already started or checked in)."}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
