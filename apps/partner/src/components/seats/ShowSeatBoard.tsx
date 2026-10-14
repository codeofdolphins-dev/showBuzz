"use client";

import { Fragment, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Accessibility, Ban, RefreshCw, Undo2, Unlock } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { formatDateLong, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { Card } from "@showbuzz/console-ui/PageParts";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { SeatBoardState, ShowSeatBoard as Board } from "@showbuzz/schemas/types/partner-venue";
import { blockSeatsAction, releaseHoldsAction, unblockSeatsAction } from "@/app/_actions/venues";
import { ACCENT_SEAT, SEAT_CELL } from "./seat-styles";
import { useSeatSelection } from "./use-seat-selection";

/**
 * Prototype seat-management.html "Live Show Seat Block & Hold Manager": one show's seats as they are right now.
 * Select seats (click or drag), then block them for this show, put blocked seats back on sale, or release a stuck
 * checkout hold. Sold seats can't be touched here; cancelling a booking frees them.
 */

const STATE_STYLE: Record<Exclude<SeatBoardState, "free">, string> = {
  sold: "border-slate-400 bg-slate-300 text-slate-700",
  pending: "border-orange-400 bg-orange-200 text-orange-900",
  held: "border-amber-400 bg-amber-100 text-amber-900",
  blocked: "border-red-400 bg-red-200 text-red-900",
  unavailable: "border-dashed border-slate-200 bg-white text-slate-300",
};

const LEGEND: { state: SeatBoardState; label: string }[] = [
  { state: "free", label: "Free" },
  { state: "sold", label: "Sold" },
  { state: "pending", label: "Awaiting payment" },
  { state: "held", label: "In checkout" },
  { state: "blocked", label: "Blocked for this show" },
  { state: "unavailable", label: "Blocked in layout" },
];

export function ShowSeatBoard({ board }: { board: Board }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmRelease, setConfirmRelease] = useState(false);

  const rows = useMemo(() => board.zones.flatMap((z) => z.rows), [board.zones]);
  // Display-row index where each zone starts (the selection hook addresses rows by display index).
  const zoneOffsets = useMemo(
    () => board.zones.map((_, i) => board.zones.slice(0, i).reduce((sum, z) => sum + z.rows.length, 0)),
    [board.zones],
  );
  const gridRows = useMemo(() => rows.map((r) => ({ letter: r.row, count: r.seats.length })), [rows]);
  const { selected, setSelected, clear, gridHandlers } = useSeatSelection(gridRows);

  const stateOf = useMemo(() => {
    const map = new Map<string, SeatBoardState>();
    for (const row of rows) for (const seat of row.seats) map.set(seat.id, seat.state);
    return map;
  }, [rows]);
  const selectedIn = (states: SeatBoardState[]) =>
    [...selected].filter((id) => states.includes(stateOf.get(id) ?? "free"));

  function run(kind: "block" | "unblock" | "release") {
    const seatIds =
      kind === "block"
        ? selectedIn(["free"])
        : kind === "unblock"
          ? selectedIn(["blocked"])
          : selectedIn(["held", "pending"]);
    if (seatIds.length === 0) {
      toast.info(
        kind === "block"
          ? "Select free seats to block."
          : kind === "unblock"
            ? "Select blocked seats to put back on sale."
            : "Select seats that are in checkout or awaiting payment.",
      );
      return;
    }
    startTransition(async () => {
      const input = { showId: board.show.id, seatIds };
      const result =
        kind === "block"
          ? await blockSeatsAction(input)
          : kind === "unblock"
            ? await unblockSeatsAction(input)
            : await releaseHoldsAction(input);
      setConfirmRelease(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      const verb = kind === "block" ? "Blocked" : kind === "unblock" ? "Back on sale" : "Released";
      if (result.data.changed.length > 0) toast.success(`${verb}: ${result.data.changed.join(", ")}`);
      if (result.data.skipped.length > 0) {
        toast.info(`Not changed (taken or changed meanwhile): ${result.data.skipped.join(", ")}`);
      }
      clear();
      router.refresh();
    });
  }

  function onSeatKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const { show, counts } = board;
  const pendingSelected = selectedIn(["pending"]).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Free" value={counts.free} />
        <Kpi label="Sold" value={counts.sold} />
        <Kpi label="In checkout / awaiting payment" value={counts.held + counts.pending} tone="text-amber-600" />
        <Kpi label="Blocked (show + layout)" value={counts.blocked + counts.unavailable} tone="text-admin-danger" />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 border-b border-admin-border pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-bold text-admin-dark">{show.title}</h2>
            <p className="text-[11px] text-admin-subtle">
              {show.venueName} · {show.screenName}
              {show.startsAt
                ? ` · ${formatDateLong(new Date(show.startsAt))}, ${formatTime(new Date(show.startsAt))}`
                : null}
              {show.started ? " · started (read-only)" : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-admin-dark">{selected.size} selected</span>
            <Button type="button" variant="secondary" disabled={pending || show.started} onClick={() => run("block")}>
              <Ban className="h-4 w-4" aria-hidden /> Block
            </Button>
            <Button type="button" variant="secondary" disabled={pending || show.started} onClick={() => run("unblock")}>
              <Undo2 className="h-4 w-4" aria-hidden /> Unblock
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || show.started}
              onClick={() => (pendingSelected > 0 ? setConfirmRelease(true) : run("release"))}
            >
              <Unlock className="h-4 w-4" aria-hidden /> Release hold
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => router.refresh()}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-admin-muted">
          {LEGEND.map(({ state, label }) => (
            <span key={state} className="flex items-center gap-1.5">
              <span
                className={cn("h-3.5 w-3.5 rounded border", state === "free" ? ACCENT_SEAT.indigo : STATE_STYLE[state])}
                aria-hidden
              />
              {label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="mx-auto w-max min-w-full space-y-1.5" {...gridHandlers}>
            <div className="mx-auto mb-5 w-2/3 rounded-b-3xl border-t-4 border-admin-indigo/60 pt-1 text-center text-[10px] font-bold tracking-[0.3em] text-admin-subtle uppercase">
              {board.layoutType === "stadium" ? "Pitch / stage" : "Screen this way"}
            </div>
            {board.zones.map((zone, zoneIndex) => (
              <Fragment key={zone.id}>
                <p className="pt-3 text-[11px] font-bold tracking-wider text-admin-muted uppercase">
                  {zone.name} · {formatINR(zone.pricePaise)}
                </p>
                {zone.rows.map((row, i) => {
                  const rowIndex = (zoneOffsets[zoneIndex] ?? 0) + i;
                  return (
                    <div key={row.row} className="flex items-center justify-center gap-2">
                      <span className="w-5 text-center font-mono text-xs font-bold text-admin-muted">{row.row}</span>
                      <div className="flex touch-none items-center gap-1">
                        {row.seats.map((seat) => {
                          const isSelected = selected.has(seat.id);
                          return (
                            <Fragment key={seat.id}>
                              <button
                                type="button"
                                data-seat={seat.id}
                                data-r={rowIndex}
                                data-n={seat.number}
                                onKeyDown={(e) => onSeatKey(e, seat.id)}
                                aria-pressed={isSelected}
                                aria-label={`Seat ${seat.id}, ${LEGEND.find((l) => l.state === seat.state)?.label ?? seat.state}`}
                                title={`${seat.id} · ${LEGEND.find((l) => l.state === seat.state)?.label ?? ""}`}
                                className={cn(
                                  SEAT_CELL,
                                  "cursor-pointer",
                                  seat.state === "free" ? ACCENT_SEAT[zone.accent] : STATE_STYLE[seat.state],
                                  isSelected && "scale-110 ring-2 ring-admin-indigo ring-offset-1",
                                )}
                              >
                                {seat.accessible && seat.state === "free" ? (
                                  <Accessibility className="h-3 w-3" aria-hidden />
                                ) : (
                                  seat.number
                                )}
                              </button>
                              {row.aislesAfter.includes(seat.number) ? (
                                <span className="w-4 shrink-0" aria-hidden />
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </div>
                      <span className="w-5 text-center font-mono text-xs font-bold text-admin-muted">{row.row}</span>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmRelease}
        title="Release seats awaiting payment?"
        description={`${pendingSelected} selected seat(s) belong to an order waiting for payment. If you release them, that payment fails and the customer is refunded in full.`}
        confirmLabel="Release anyway"
        pending={pending}
        onConfirm={() => run("release")}
        onCancel={() => setConfirmRelease(false)}
      />
    </div>
  );
}

function Kpi({ label, value, tone = "text-admin-dark" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-[11px] font-bold tracking-wider text-admin-subtle uppercase">{label}</p>
      <p className={cn("text-2xl font-black", tone)}>{value.toLocaleString("en-IN")}</p>
    </Card>
  );
}
