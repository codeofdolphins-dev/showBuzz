import type { EventSchedule } from "@/schemas/event";
import { formatDateLong, formatTime, istDateKey, istDateTime } from "./dates";

const wallClock = (time: string) => formatTime(istDateTime("2026-01-01", time));

/** Display strings for an event schedule, e.g. { date: "Sat, 14 Nov 2026", time: "05:00 PM" }. */
export function describeSchedule(schedule: EventSchedule): { date: string; time: string } {
  if (schedule.type === "daily") {
    return {
      date: "Daily Slots Available",
      time: `${wallClock(schedule.opensAt)} - ${wallClock(schedule.closesAt)}`,
    };
  }
  const start = new Date(schedule.startsAt);
  if (!schedule.endsAt) return { date: formatDateLong(start), time: formatTime(start) };

  const end = new Date(schedule.endsAt);
  const sameDay = istDateKey(start) === istDateKey(end);
  return {
    date: sameDay ? formatDateLong(start) : `${formatDateLong(start)} - ${formatDateLong(end)}`,
    time: `${formatTime(start)} - ${formatTime(end)}`,
  };
}
