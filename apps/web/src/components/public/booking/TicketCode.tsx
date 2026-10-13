import { TicketX } from "lucide-react";

/**
 * The M-ticket QR. `svg` is rendered on the server by `renderTicketQrSvg` (qrcode library output from a
 * signed payload, no user input), so it is safe to inline. Without it (cancelled booking) a void mark is shown.
 */
export function TicketCode({ code, svg }: { code: string; svg?: string }) {
  if (!svg) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 text-slate-400"
        role="img"
        aria-label={`Ticket ${code} is no longer valid`}
      >
        <TicketX className="h-8 w-8" />
        <span className="text-[9px] font-black tracking-wider uppercase">Void</span>
      </div>
    );
  }
  return (
    <div
      className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
      role="img"
      aria-label={`Entry QR code for booking ${code}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
