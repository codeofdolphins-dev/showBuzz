import { z } from "zod";

/** Dashboard periods (back-office prompt 8): today, the last 7 or the last 30 IST days including today. */
export const DASHBOARD_RANGES = ["today", "7d", "30d"] as const;
export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

/** IST days in each range (today = 1). */
export const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = { today: 1, "7d": 7, "30d": 30 };
