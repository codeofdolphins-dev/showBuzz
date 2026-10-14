"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid3x3, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { EmptyState } from "@showbuzz/console-ui/DataTable";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { VendorScreenSummary } from "@showbuzz/schemas/types/partner-venue";
import { formatINR } from "@showbuzz/utils/money";
import { deleteScreenAction } from "@/app/_actions/venues";
import { ACCENT_SWATCH } from "@/components/seats/seat-styles";

/** Prototype screens.html: one row per auditorium with capacity, formats, sound and its seat map. */
export function ScreenList({ venueId, screens }: { venueId: string; screens: VendorScreenSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<VendorScreenSummary | null>(null);

  function confirmDelete() {
    if (!toDelete) return;
    startTransition(async () => {
      const result = await deleteScreenAction(venueId, toDelete.id);
      if (!result.success) {
        toast.error(result.error.message);
      } else {
        toast.success(`${result.data.name} removed.`);
        router.refresh();
      }
      setToDelete(null);
    });
  }

  if (screens.length === 0) {
    return (
      <EmptyState
        title="No screens yet"
        description="Add each auditorium, hall or stadium layout, then design its seats."
        action={
          <Link href={`/venues/${venueId}/screens/new`} className="text-xs font-bold text-admin-indigo hover:underline">
            Add the first screen
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
            <tr>
              <th className="px-4 py-2.5 font-bold">Screen</th>
              <th className="px-4 py-2.5 font-bold">Capacity</th>
              <th className="px-4 py-2.5 font-bold">Formats</th>
              <th className="px-4 py-2.5 font-bold">Sound</th>
              <th className="px-4 py-2.5 font-bold">Seat categories</th>
              <th className="px-4 py-2.5 font-bold">Upcoming shows</th>
              <th className="px-4 py-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {screens.map((screen) => (
              <tr key={screen.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-bold text-admin-dark">{screen.name}</p>
                  <p className="text-[11px] text-admin-subtle">
                    {screen.layoutType === "stadium" ? "Stadium" : "Auditorium"} · {screen.rows} rows
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone="info">{screen.capacity.toLocaleString("en-IN")} seats</StatusBadge>
                  {screen.blockedSeats > 0 ? (
                    <p className="mt-1 text-[11px] text-admin-subtle">{screen.blockedSeats} blocked</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {screen.formats.length > 0
                      ? screen.formats.map((f) => (
                          <StatusBadge key={f} tone="indigo">
                            {f}
                          </StatusBadge>
                        ))
                      : "—"}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-admin-muted">{screen.soundSystem || "—"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {screen.categories.map((c) => (
                      <p key={c.name} className="flex items-center gap-1.5 text-[11px]">
                        <span className={`h-2.5 w-2.5 rounded-sm ${ACCENT_SWATCH[c.accent]}`} aria-hidden />
                        {c.name} · {c.seats} · {formatINR(c.defaultPricePaise)}
                      </p>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{screen.upcomingShows}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/venues/${venueId}/screens/${screen.id}/layout`}
                      className="inline-flex items-center gap-1 rounded-md border border-admin-border px-2.5 py-1.5 text-[11px] font-bold text-admin-indigo hover:bg-admin-active"
                    >
                      <Grid3x3 className="h-3.5 w-3.5" aria-hidden /> Edit layout
                    </Link>
                    <Link
                      href={`/venues/${venueId}/screens/${screen.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${screen.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setToDelete(screen)}
                      disabled={screen.upcomingShows > 0}
                      title={screen.upcomingShows > 0 ? "This screen has upcoming shows" : undefined}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-red-50 hover:text-admin-danger disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove ${screen.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Remove ${toDelete?.name ?? "screen"}?`}
        description="Its seat layout is deleted. Past bookings keep their tickets. This can't be undone."
        confirmLabel="Remove screen"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
