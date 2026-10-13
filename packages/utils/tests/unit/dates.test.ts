import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  formatDateShort,
  formatDuration,
  formatTime,
  isDateKey,
  istDateKey,
  istDateTime,
  istHour,
  upcomingDays,
} from "@showbuzz/utils/dates";

describe("IST display of UTC dates", () => {
  // 20:00 UTC on 12 Oct is 01:30 IST on 13 Oct.
  const lateEveningUtc = new Date("2026-10-12T20:00:00Z");

  it("puts a late-evening UTC instant on the next IST calendar day", () => {
    expect(istDateKey(lateEveningUtc)).toBe("2026-10-13");
    expect(istHour(lateEveningUtc)).toBe(1);
  });

  it("formats times in IST with a 12-hour clock", () => {
    expect(formatTime(new Date("2026-10-12T12:45:00Z"))).toBe("06:15 PM");
  });

  it("formats short dates in IST", () => {
    expect(formatDateShort(lateEveningUtc)).toBe("13 Oct 2026");
  });
});

describe("istDateTime", () => {
  it("turns an IST wall-clock time into the matching UTC instant", () => {
    expect(istDateTime("2026-10-12", "18:15").toISOString()).toBe("2026-10-12T12:45:00.000Z");
  });
});

describe("date keys", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("accepts yyyy-mm-dd and rejects other shapes", () => {
    expect(isDateKey("2026-10-12")).toBe(true);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("12-10-2026")).toBe(false);
  });
});

describe("upcomingDays", () => {
  it("labels today and tomorrow, then weekdays, across a year boundary", () => {
    expect(upcomingDays("2026-12-30", 4)).toEqual([
      { key: "2026-12-30", dayLabel: "TODAY", dayOfMonth: "30", monthLabel: "DEC" },
      { key: "2026-12-31", dayLabel: "TOM", dayOfMonth: "31", monthLabel: "DEC" },
      { key: "2027-01-01", dayLabel: "FRI", dayOfMonth: "1", monthLabel: "JAN" },
      { key: "2027-01-02", dayLabel: "SAT", dayOfMonth: "2", monthLabel: "JAN" },
    ]);
  });
});

describe("formatDuration", () => {
  it("formats minutes as hours and zero-padded minutes", () => {
    expect(formatDuration(168)).toBe("2h 48m");
    expect(formatDuration(60)).toBe("1h 00m");
    expect(formatDuration(45)).toBe("45m");
  });
});
