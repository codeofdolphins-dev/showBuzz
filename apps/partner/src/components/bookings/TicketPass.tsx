"use client";

import { Printer } from "lucide-react";
import { Button } from "@showbuzz/console-ui/form";

interface TicketPassProps {
  code: string;
  title: string;
  venueLine: string;
  scheduleLabel: string;
  seats: string;
  totalLabel: string;
  customerName?: string | undefined;
  /** Server-rendered QR SVG (qrcode output: no script). */
  qrSvg: string;
}

/**
 * Prototype booking-details "Digital Box Office Pass" / booking-form confirmation: the signed QR ticket, printable.
 * Printing hides everything else on the page (`print:` utilities on the pass and `.ticket-print-area`).
 */
export function TicketPass({
  code,
  title,
  venueLine,
  scheduleLabel,
  seats,
  totalLabel,
  customerName,
  qrSvg,
}: TicketPassProps) {
  return (
    <div className="ticket-print-area space-y-4">
      <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-admin-border bg-white shadow-card">
        <div className="bg-admin-dark px-4 py-3 text-white">
          <p className="text-[10px] font-bold tracking-widest text-indigo-200 uppercase">ShowBuzz M-Ticket</p>
          <p className="truncate text-sm font-black">{title}</p>
        </div>
        <div className="space-y-3 p-4">
          <div
            className="mx-auto h-44 w-44 [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label={`Ticket QR code for ${code}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-center font-mono text-sm font-black tracking-wider text-admin-dark">{code}</p>
          <dl className="grid grid-cols-2 gap-2 border-t border-dashed border-admin-border pt-3 text-[11px]">
            <Term label="Venue" value={venueLine} wide />
            <Term label="When" value={scheduleLabel} wide />
            <Term label="Seats / passes" value={seats} />
            <Term label="Paid" value={totalLabel} />
            {customerName ? <Term label="Customer" value={customerName} wide /> : null}
          </dl>
        </div>
      </div>
      <div className="flex justify-center print:hidden">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print ticket
        </Button>
      </div>
    </div>
  );
}

function Term({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="font-semibold text-admin-subtle uppercase">{label}</dt>
      <dd className="font-bold text-admin-dark">{value}</dd>
    </div>
  );
}
