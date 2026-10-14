import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { QrCode } from "lucide-react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorBooking } from "@showbuzz/core/services/partner/booking.service";
import { describeCutoff } from "@showbuzz/schemas/vendor";
import { formatDateLong, formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { PAYMENT_METHOD_LABELS } from "@showbuzz/utils/payment";
import { BookingStatusBadge } from "@/components/bookings/BookingStatusBadge";
import { CancelBookingButton } from "@/components/bookings/CancelBookingButton";
import { TicketPass } from "@/components/bookings/TicketPass";
import { LinkButton } from "@/components/venues/LinkButton";

export const metadata: Metadata = { title: "Booking" };

const at = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

/**
 * Prototype booking-details.html: show and seats, customer (only when ShowBuzz shares contact details, or the walk-in
 * name of a counter sale), the money breakdown with the vendor's share, check-in, cancel & refund, and the ticket QR
 * for reprinting.
 */
export default async function BookingPage({ params }: PageProps<"/bookings/[code]">) {
  const { code } = await params;
  const { vendor } = await requireVendorPage(`/bookings/${code}`);
  const booking = await getVendorBooking(vendor.id, decodeURIComponent(code), new Date());
  if (!booking) notFound();
  const { amounts, settlement } = booking;
  const counter = booking.channel === "counter";

  return (
    <>
      <PageHeader
        title={booking.code}
        crumb="Bookings"
        subtitle={`${booking.title} · ${booking.venueName}${booking.screenName ? ` · ${booking.screenName}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {booking.status === "confirmed" && !booking.checkedInAt ? (
              <LinkButton href={`/scan-tickets?code=${booking.code}`} variant="secondary">
                <QrCode className="h-4 w-4" aria-hidden /> Check in
              </LinkButton>
            ) : null}
            {booking.vendorCanCancel && !booking.checkedInAt ? (
              <CancelBookingButton
                code={booking.code}
                totalPaise={amounts.totalPaise}
                policy={booking.policy}
                withinPolicy={booking.withinPolicy}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-admin-border pb-3">
              <h2 className="text-sm font-bold text-admin-dark">Showtime & seat allocation</h2>
              <BookingStatusBadge booking={booking} />
            </div>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <Term label="Show date">
                {booking.startsAt ? formatDateLong(new Date(booking.startsAt)) : booking.scheduleLabel}
              </Term>
              <Term label="Show time (IST)">{booking.startsAt ? formatTime(new Date(booking.startsAt)) : "—"}</Term>
              <Term label="Seats / passes">{booking.seatLabels.join(", ")}</Term>
              <Term label="Seat category / tier">{booking.ticketLabel}</Term>
              <Term label="Screen / gate">{booking.screenName ?? "—"}</Term>
              <Term label="Format & language">
                {[booking.format, booking.language].filter(Boolean).join(" · ") || "—"}
              </Term>
              <Term label="Booked">
                {at(booking.bookedAt)} ·{" "}
                {counter ? `Counter${booking.soldByName ? ` (${booking.soldByName})` : ""}` : "Online"}
              </Term>
              <Term label="Check-in">
                {booking.checkedInAt
                  ? `${at(booking.checkedInAt)}${booking.checkedInByName ? ` by ${booking.checkedInByName}` : ""}`
                  : "Not checked in"}
              </Term>
            </dl>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="border-b border-admin-border pb-3 text-sm font-bold text-admin-dark">Customer</h2>
            {booking.contact ? (
              <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                <Term label="Name">{booking.contact.name ?? "—"}</Term>
                <Term label="Phone">{booking.contact.phone ?? "—"}</Term>
                <Term label="Email">{booking.contact.email ?? "—"}</Term>
              </dl>
            ) : (
              <p className="text-xs text-admin-muted">
                {counter
                  ? "Walk-in customer (no details taken)."
                  : "Hidden. ShowBuzz shares customer contact details only when enabled for your account."}
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="border-b border-admin-border pb-3 text-sm font-bold text-admin-dark">Payment & breakdown</h2>
            <dl className="space-y-2 text-xs">
              <Line label={`Tickets (${booking.ticketCount})`} value={amounts.ticketsPaise} />
              {booking.food.map((f) => (
                <Line key={f.foodItemId} label={`${f.name} × ${f.quantity}`} value={f.totalPaise} />
              ))}
              {amounts.convenienceFeePaise > 0 ? (
                <Line label="Convenience fee (ShowBuzz)" value={amounts.convenienceFeePaise} />
              ) : null}
              {amounts.gstPaise > 0 ? (
                <Line label="GST on convenience fee (ShowBuzz)" value={amounts.gstPaise} />
              ) : null}
              {amounts.discountPaise > 0 ? (
                <Line
                  label={`Discount${booking.couponCode ? ` (${booking.couponCode})` : ""}`}
                  value={-amounts.discountPaise}
                />
              ) : null}
              <Line label="Total collected" value={amounts.totalPaise} strong />
              {amounts.giftCardPaise > 0 ? (
                <Line label="Paid with a gift card" value={amounts.giftCardPaise} muted />
              ) : null}
              <div className="flex justify-between text-admin-muted">
                <dt>Payment method</dt>
                <dd className="font-semibold">
                  {PAYMENT_METHOD_LABELS[booking.paymentMethod]}
                  {booking.paymentReference ? ` · Ref ${booking.paymentReference}` : ""}
                </dd>
              </div>
            </dl>
            {settlement ? (
              <dl className="space-y-2 border-t border-dashed border-admin-border pt-3 text-xs">
                <Line
                  label="Your sales (tickets + food − discount)"
                  value={settlement.subtotalPaise - settlement.discountPaise}
                />
                {settlement.commissionPaise > 0 ? (
                  <Line
                    label={`ShowBuzz commission (${(settlement.commissionBps / 100).toFixed(2).replace(/\.00$/, "")}%)`}
                    value={-settlement.commissionPaise}
                  />
                ) : null}
                <Line label="Your share" value={settlement.vendorSharePaise} strong />
              </dl>
            ) : null}
          </Card>

          {booking.status === "cancelled" ? (
            <Card className="space-y-2 border-red-200 bg-red-50/40 p-5 text-xs">
              <h2 className="text-sm font-bold text-admin-danger">Cancelled</h2>
              <p>
                {booking.cancelledAt ? at(booking.cancelledAt) : ""} by{" "}
                {booking.cancelledBy === "vendor" ? "you" : "the customer"}. Refund{" "}
                <strong>{formatINR(booking.refundPaise ?? 0, { exact: true })}</strong>.
              </p>
              {booking.cancelReason ? <p className="text-admin-muted">Reason: {booking.cancelReason}</p> : null}
            </Card>
          ) : (
            <p className="text-[11px] text-admin-muted">
              Policy at purchase:{" "}
              {booking.policy.allowed
                ? `cancellable ${describeCutoff(booking.policy.cutoffMinutes)}, fee ${formatINR(booking.policy.feePaise)}.`
                : "not cancellable by the customer."}
            </p>
          )}
        </div>

        <div>
          {booking.qrSvg ? (
            <TicketPass
              code={booking.code}
              title={booking.title}
              venueLine={`${booking.venueName}${booking.screenName ? ` · ${booking.screenName}` : ""}`}
              scheduleLabel={booking.scheduleLabel}
              seats={booking.seatLabels.join(", ")}
              totalLabel={formatINR(amounts.totalPaise, { exact: true })}
              customerName={booking.contact?.name}
              qrSvg={booking.qrSvg}
            />
          ) : (
            <Card className="p-5 text-center text-xs text-admin-muted">This ticket is void (cancelled).</Card>
          )}
        </div>
      </div>
    </>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}

function Line({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t border-admin-border pt-2 font-bold text-admin-dark" : muted ? "text-admin-muted" : ""}`}
    >
      <dt>{label}</dt>
      <dd className="font-mono">
        {value < 0 ? `− ${formatINR(-value, { exact: true })}` : formatINR(value, { exact: true })}
      </dd>
    </div>
  );
}
