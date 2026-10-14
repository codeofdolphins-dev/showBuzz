import { AlertTriangle } from "lucide-react";
import type { LayoutConflictShow } from "@showbuzz/schemas/types/partner-venue";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";

/** The upcoming shows that stop a change (seats sold or in checkout), with the seats concerned. */
export function ConflictShows({ shows }: { shows: LayoutConflictShow[] }) {
  return (
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      <p className="mb-2 flex items-center gap-2 font-bold">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Affected upcoming shows
      </p>
      <ul className="space-y-1">
        {shows.map((show) => (
          <li key={show.id}>
            <span className="font-semibold">{show.title}</span>
            {show.startsAt
              ? ` · ${formatDateShort(new Date(show.startsAt))}, ${formatTime(new Date(show.startsAt))}`
              : null}
            {show.seats.length > 0 ? <span className="font-mono"> · seats {show.seats.join(", ")}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
