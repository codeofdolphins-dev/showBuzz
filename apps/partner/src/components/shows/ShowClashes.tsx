import { CalendarX2 } from "lucide-react";
import type { ShowClash } from "@showbuzz/schemas/types/partner-listing";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";

export interface ShowClashList {
  clashes: ShowClash[];
  /** All clashes found (the list may be cut short). */
  total: number;
}

const at = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

/** Shows already on the screen that a new show would overlap (running time plus the 15-minute changeover). */
export function ShowClashes({ clashes, total }: ShowClashList) {
  return (
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      <p className="mb-2 flex items-center gap-2 font-bold">
        <CalendarX2 className="h-4 w-4" aria-hidden /> The screen is busy
      </p>
      <ul className="space-y-1">
        {clashes.map((c, i) => (
          <li key={`${c.requestedStartsAt}-${c.startsAt}-${i}`}>
            Your {at(c.requestedStartsAt)} show overlaps <span className="font-semibold">{c.title}</span> (
            {at(c.startsAt)} – {formatTime(new Date(c.endsAt))})
          </li>
        ))}
      </ul>
      {total > clashes.length ? <p className="mt-1">…and {total - clashes.length} more.</p> : null}
    </div>
  );
}
