"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrCode, TicketX } from "lucide-react";
import { cancelBookingAction } from "@/app/(public)/_actions/booking";
import { TicketCode } from "@/components/public/booking/TicketCode";
import { EmptyState } from "@/components/public/common/EmptyState";
import { Modal } from "@showbuzz/ui/Modal";
import { cn } from "@showbuzz/utils/cn";
import { formatINR } from "@showbuzz/utils/money";
import { PAYMENT_METHOD_LABELS } from "@showbuzz/utils/payment";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { toast } from "@/stores/ui";
import type { BookingView } from "@showbuzz/schemas/types/booking";

interface BookingsListProps {
  bookings: BookingView[];
  /** From Settings, for the cancellation dialog (the server applies the same values). */
  cancellation: { feePaise: number; cutoffMinutes: number };
  /** Server-rendered QR SVGs for upcoming confirmed bookings, by booking code. */
  qrCodes: Record<string, string>;
}

export function BookingsList({ bookings, cancellation, qrCodes }: BookingsListProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [confirming, setConfirming] = useState<BookingView | null>(null);
  const [openQr, setOpenQr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = bookings.filter((b) => (tab === "active" ? b.phase === "upcoming" : b.phase !== "upcoming"));

  const cancel = (booking: BookingView) =>
    startTransition(async () => {
      const result = await withAuthRetry(() => cancelBookingAction(booking.code));
      setConfirming(null);
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      toast(`Booking ${booking.code} cancelled. ${formatINR(result.data.refundPaise, { exact: true })} refund initiated.`, "info");
      router.refresh();
    });

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-3xl">My Bookings & Passes</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage your digital M-tickets and review cancellation refunds</p>
        </div>
        <div className="flex w-fit rounded-2xl bg-slate-200/80 p-1 text-xs font-bold" role="tablist">
          {(
            [
              ["active", "Active Passes"],
              ["past", "Cancelled / Past"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "tap-active rounded-xl px-4 py-1.5 transition-all",
                tab === value ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={TicketX}
          title="No Bookings Found"
          description="You have no tickets in this category. Ready to catch the next blockbuster or live gig?"
          action={
            <Link href="/movies" className="gradient-btn tap-active inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md">
              Explore Entertainment &rarr;
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((b) => (
            <article key={b.code} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 sm:p-6">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3 sm:gap-4">
                  <Image src={b.poster} alt="" width={64} height={96} className="aspect-[2/3] w-14 shrink-0 rounded-2xl object-cover shadow-sm sm:w-16" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 text-[9px] font-extrabold uppercase",
                          b.phase === "upcoming" && "border border-emerald-200 bg-emerald-50 text-emerald-600",
                          b.phase === "past" && "bg-slate-100 text-slate-500",
                          b.phase === "cancelled" && "bg-rose-50 text-rose-600",
                        )}
                      >
                        {b.phase === "upcoming" ? "Confirmed" : b.phase === "past" ? "Completed" : "Cancelled"}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-400">ID: {b.code}</span>
                    </div>
                    <h3 className="text-sm leading-snug font-black text-slate-900 sm:text-base">{b.title}</h3>
                    <p className="text-xs font-medium text-slate-600">
                      {b.venueName} &bull; {b.scheduleLabel}
                    </p>
                    <p className="text-xs font-bold text-slate-700">
                      Seats: <span className="text-rose-600">{b.seatLabels.join(", ")}</span> ({b.ticketCount}{" "}
                      {b.ticketCount === 1 ? "Ticket" : "Tickets"})
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Paid Amount</span>
                  <span className="text-base font-black text-slate-900 sm:text-lg">{formatINR(b.amounts.totalPaise, { exact: true })}</span>
                  <span className="block text-[10px] text-slate-400">{PAYMENT_METHOD_LABELS[b.paymentMethod]}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <QrCode className="h-3 w-3 text-slate-400" />
                  {b.phase === "cancelled"
                    ? `Refund of ${formatINR(b.refundPaise ?? 0, { exact: true })} processed`
                    : b.phase === "past"
                      ? "Show completed"
                      : "QR entry active at scanner"}
                </span>
                <div className="flex items-center gap-2">
                  {b.canCancel && (
                    <button
                      type="button"
                      onClick={() => setConfirming(b)}
                      className="tap-active rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      Cancel & Refund
                    </button>
                  )}
                  {qrCodes[b.code] && (
                    <button
                      type="button"
                      onClick={() => setOpenQr((c) => (c === b.code ? null : b.code))}
                      aria-expanded={openQr === b.code}
                      className="tap-active flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <QrCode className="h-3 w-3" /> {openQr === b.code ? "Hide QR" : "Show QR"}
                    </button>
                  )}
                  {b.phase !== "cancelled" && (
                    <Link
                      href={`/booking/success?id=${b.code}`}
                      className="gradient-btn tap-active rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                    >
                      View M-Ticket &rarr;
                    </Link>
                  )}
                </div>
              </div>
              {openQr === b.code && qrCodes[b.code] && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                  <div className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <TicketCode code={b.code} svg={qrCodes[b.code]} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-slate-700 uppercase">Scan at Gate</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="Cancel this booking?" sheetOnMobile={false}>
        {confirming && (
          <>
            <p className="text-xs leading-relaxed text-slate-600">
              Booking <strong>{confirming.code}</strong> will be cancelled. A cancellation fee of{" "}
              {formatINR(cancellation.feePaise)} applies; you&apos;ll receive{" "}
              <strong>
                {formatINR(Math.max(0, confirming.amounts.totalPaise - cancellation.feePaise), { exact: true })}
              </strong>{" "}
              back to {PAYMENT_METHOD_LABELS[confirming.paymentMethod]}. Cancellations close {cancellation.cutoffMinutes} minutes
              before the show.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirming(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600">
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => cancel(confirming)}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Cancel Booking
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
