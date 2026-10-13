"use client";

import Link from "next/link";
import { CalendarPlus, Printer, Ticket } from "lucide-react";

export function TicketActions({ calendarUrl }: { calendarUrl?: string }) {
  const button =
    "tap-active flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:px-5 sm:py-3";
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button type="button" onClick={() => window.print()} className={button}>
        <Printer className="h-4 w-4 text-rose-500" /> Print / Save as PDF
      </button>
      {calendarUrl && (
        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className={button}>
          <CalendarPlus className="h-4 w-4 text-emerald-500" /> Add to Calendar
        </a>
      )}
      <Link
        href="/account/bookings"
        className="gradient-btn tap-active flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-500/20 sm:px-6 sm:py-3"
      >
        <Ticket className="h-4 w-4" /> My Bookings
      </Link>
    </div>
  );
}
