import "server-only";
import { DASHBOARD_RANGE_DAYS, type DashboardRange } from "@showbuzz/schemas/dashboard";
import type { BookingStatus } from "@showbuzz/schemas/types/booking";
import type { TrendPoint } from "@showbuzz/schemas/types/dashboard";
import { addDaysToKey, formatDateShort, istDateKey, istDateTime } from "@showbuzz/utils/dates";

/**
 * The window a dashboard covers: whole IST days ending today, plus the same length just before it (for the "vs
 * previous period" figures). Today is bucketed by hour, longer ranges by day.
 */
export interface DashboardWindow {
  range: DashboardRange;
  fromKey: string;
  toKey: string;
  from: Date;
  /** Exclusive: midnight after today. */
  to: Date;
  previousFrom: Date;
  bucket: "hour" | "day";
  /** `$dateToString` format of the buckets (IST). */
  bucketFormat: string;
}

export function dashboardWindow(range: DashboardRange, now: Date): DashboardWindow {
  const days = DASHBOARD_RANGE_DAYS[range];
  const toKey = istDateKey(now);
  const fromKey = addDaysToKey(toKey, -(days - 1));
  const bucket = range === "today" ? "hour" : "day";
  return {
    range,
    fromKey,
    toKey,
    from: istDateTime(fromKey, "00:00"),
    to: istDateTime(addDaysToKey(toKey, 1), "00:00"),
    previousFrom: istDateTime(addDaysToKey(fromKey, -days), "00:00"),
    bucket,
    bucketFormat: bucket === "hour" ? "%H" : "%Y-%m-%d",
  };
}

/** Every bucket of the window in order, with the aggregated values filled in (missing buckets are zero). */
export function fillTrend(
  window: DashboardWindow,
  rows: { _id: string; salesPaise: number; tickets: number }[],
): TrendPoint[] {
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const keys =
    window.bucket === "hour"
      ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))
      : Array.from({ length: DASHBOARD_RANGE_DAYS[window.range] }, (_, i) => addDaysToKey(window.fromKey, i));
  return keys.map((key) => ({
    key,
    label: window.bucket === "hour" ? `${key}:00` : formatDateShort(istDateTime(key, "12:00")),
    salesPaise: byKey.get(key)?.salesPaise ?? 0,
    tickets: byKey.get(key)?.tickets ?? 0,
  }));
}

/** Bookings that were sold: confirmed, or confirmed and cancelled later. */
export const SOLD_STATUSES: BookingStatus[] = ["confirmed", "cancelled"];
