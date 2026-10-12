import { APP_TIME_ZONE, IST_OFFSET } from "@/config/constants";

/** Dates are stored in UTC and displayed in IST. Never parse display strings back into dates. */

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const shortDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" });
const monthFormat = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "short" });
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, day: "numeric" });
const monthYearFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  year: "numeric",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-10" for the IST calendar day containing `date`. */
export function istDateKey(date: Date): string {
  return dateKeyFormat.format(date);
}

/** Builds the UTC instant for an IST calendar day and "HH:mm" wall-clock time. */
export function istDateTime(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00${IST_OFFSET}`);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Adds whole days to a "yyyy-mm-dd" key without touching time zones. */
export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23" });

/** 0-23 hour of day in IST. */
export function istHour(date: Date): number {
  return Number(hourFormat.format(date));
}

/** 0 = Sunday, in IST. */
export function istWeekday(date: Date): number {
  return WEEKDAYS.indexOf(weekdayFormat.format(date));
}

export function formatDateLong(date: Date): string {
  return longDateFormat.format(date);
}

export function formatDateShort(date: Date): string {
  return shortDateFormat.format(date);
}

export function formatTime(date: Date): string {
  return timeFormat.format(date).toUpperCase();
}

export function formatMonthYear(date: Date): string {
  return monthYearFormat.format(date);
}

export interface DayChip {
  key: string;
  dayLabel: string;
  dayOfMonth: string;
  monthLabel: string;
}

/** Date-picker chips starting at `todayKey`: TODAY, TOM, then weekday names. */
export function upcomingDays(todayKey: string, count: number): DayChip[] {
  return Array.from({ length: count }, (_, i) => {
    const key = addDaysToKey(todayKey, i);
    const noon = istDateTime(key, "12:00");
    const dayLabel = i === 0 ? "TODAY" : i === 1 ? "TOM" : weekdayFormat.format(noon).toUpperCase();
    return {
      key,
      dayLabel,
      dayOfMonth: dayFormat.format(noon),
      monthLabel: monthFormat.format(noon).toUpperCase(),
    };
  });
}

/** Minutes to "2h 48m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
