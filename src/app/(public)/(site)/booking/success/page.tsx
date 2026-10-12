import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarCheck, Check, MapPin, Ticket, TicketX } from "lucide-react";
import { TicketActions } from "@/components/public/booking/TicketActions";
import { TicketCode } from "@/components/public/booking/TicketCode";
import { EmptyState } from "@/components/public/common/EmptyState";
import { formatINR } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment";
import { bookingCodeSchema } from "@/schemas/booking";
import { getBooking } from "@/server/services/booking.service";
import type { BookingView } from "@/types/booking";

export const metadata: Metadata = { title: "Booking Confirmed", robots: { index: false } };

function calendarUrl(b: BookingView) {
  if (!b.startsAt) return undefined;
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + 3 * 60 * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.title} at ${b.venueName}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `Seats: ${b.seatLabels.join(", ")}. Booking ID: ${b.code}`,
    location: b.venueName,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

async function Ticketpass({ searchParams }: Pick<PageProps<"/booking/success">, "searchParams">) {
  const { id } = await searchParams;
  await connection();
  const code = bookingCodeSchema.safeParse(Array.isArray(id) ? id[0] : id);
  const booking = code.success ? await getBooking(code.data, new Date()) : undefined;
  if (!booking) {
    return (
      <EmptyState
        icon={TicketX}
        title="We couldn't find this booking"
        description="The link may be incomplete or the booking has expired. All your confirmed tickets are listed under My Bookings."
        action={
          <Link href="/account/bookings" className="gradient-btn tap-active inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md">
            Go to My Bookings &rarr;
          </Link>
        }
      />
    );
  }

  const cancelled = booking.status === "cancelled";

  return (
    <>
      <div className="mb-6 text-center sm:mb-8">
        <span
          className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full shadow-lg sm:h-20 sm:w-20 ${
            cancelled ? "bg-slate-100 text-slate-500" : "animate-bounce bg-emerald-100 text-emerald-600 shadow-emerald-500/20"
          }`}
        >
          <Check className="h-8 w-8" />
        </span>
        <span className="text-[10px] font-black tracking-widest text-emerald-600 uppercase sm:text-xs">
          {cancelled ? "Booking Cancelled" : "Payment Successful"}
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {cancelled ? "This pass is no longer valid" : "Booking Confirmed!"}
        </h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          {cancelled
            ? `Refund of ${formatINR(booking.refundPaise ?? 0, { exact: true })} is on its way to your original payment method.`
            : `Your M-ticket has been sent to ${booking.contact.email}.`}
        </p>
      </div>

      <div className="printable-ticket relative mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:mb-8">
        <div className="flex items-center justify-between bg-gradient-to-r from-rose-500 via-purple-600 to-blue-600 p-4 text-white sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md sm:h-10 sm:w-10">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <span className="text-base font-black tracking-tight sm:text-lg">
                Show<span className="text-rose-200">Buzz</span> Pass
              </span>
              <span className="block text-[9px] font-semibold tracking-wider uppercase opacity-80 sm:text-[10px]">
                Official Entry E-Ticket
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[9px] font-bold tracking-wider uppercase opacity-80 sm:text-[10px]">Booking ID</span>
            <span className="font-mono text-sm font-black sm:text-lg">{booking.code}</span>
          </div>
        </div>

        <div className="relative p-5 sm:p-8">
          <span className="ticket-notch -left-2.5 hidden border-r border-slate-300 sm:block" />
          <span className="ticket-notch -right-2.5 hidden border-l border-slate-300 sm:block" />

          <div className="grid grid-cols-1 items-center gap-6 border-b border-dashed border-slate-200 pb-6 sm:gap-8 sm:pb-8 md:grid-cols-3">
            <div className="flex items-start gap-4 sm:gap-5 md:col-span-2">
              <Image
                src={booking.poster}
                alt=""
                width={96}
                height={144}
                className="aspect-[2/3] w-16 shrink-0 rounded-2xl object-cover shadow-md sm:w-24"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {booking.certificate && (
                    <span className="rounded bg-slate-100 px-1.5 text-[9px] font-extrabold text-slate-700">{booking.certificate}</span>
                  )}
                  {booking.format && (
                    <span className="rounded bg-rose-50 px-1.5 text-[9px] font-extrabold text-rose-600 uppercase">{booking.format}</span>
                  )}
                  {booking.language && <span className="text-[11px] font-medium text-slate-500">{booking.language}</span>}
                </div>
                <h2 className="text-lg leading-tight font-black text-slate-900 sm:text-2xl">{booking.title}</h2>
                <p className="flex items-center gap-1 pt-0.5 text-xs font-semibold text-slate-600">
                  <MapPin className="h-3 w-3 text-rose-500" /> {booking.venueName}
                </p>
                <p className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <CalendarCheck className="h-3 w-3 text-blue-500" /> {booking.scheduleLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-center">
              <div className="mb-2 h-28 w-28 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:h-32 sm:w-32">
                <TicketCode code={booking.code} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-slate-700 uppercase">
                {cancelled ? "Cancelled" : "Scan at Gate"}
              </span>
              <span className="text-[9px] text-slate-400">Show this pass at entry</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 py-4 text-xs sm:grid-cols-4 sm:gap-4 sm:py-6">
            <div>
              <span className="block text-[11px] font-medium text-slate-400">{booking.kind === "movie" ? "Screen" : "Pass"}</span>
              <span className="font-bold text-slate-900">{booking.screenName ?? booking.ticketLabel}</span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Seats ({booking.ticketCount})</span>
              <span className="text-xs font-black text-rose-600 sm:text-sm">{booking.seatLabels.join(", ")}</span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Payment</span>
              <span className="font-bold text-slate-900">{PAYMENT_METHOD_LABELS[booking.paymentMethod]}</span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Amount</span>
              <span className="text-xs font-black text-emerald-600 sm:text-sm">
                {formatINR(booking.amounts.totalPaise, { exact: true })}
              </span>
            </div>
          </div>

          {booking.food.length > 0 && (
            <div className="border-b border-slate-100 py-3 text-xs">
              <span className="mb-0.5 block text-[11px] font-medium text-slate-400">Pre-Ordered Concessions:</span>
              <p className="font-bold text-slate-800">{booking.food.map((f) => `${f.quantity}x ${f.name}`).join(", ")}</p>
            </div>
          )}
        </div>
      </div>

      <TicketActions calendarUrl={cancelled ? undefined : calendarUrl(booking)} />
    </>
  );
}

export default function BookingSuccessPage({ searchParams }: PageProps<"/booking/success">) {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
      <Suspense fallback={<div className="skeleton mx-auto h-96 max-w-4xl" />}>
        <Ticketpass searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
