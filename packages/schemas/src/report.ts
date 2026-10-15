import { z } from "zod";
import { objectIdSchema } from "./common";

/**
 * Sales and finance reports (back-office prompt 8): shown as a table in the console and exported as CSV by a route
 * handler. The same filters drive both. Dates are IST days; sales count bookings by the day they were paid for.
 */

export const ADMIN_REPORTS = ["sales-by-vendor", "sales-by-venue", "sales-by-title", "payouts", "invoices"] as const;
export const PARTNER_REPORTS = ["sales-by-venue", "sales-by-title", "bookings", "payouts"] as const;

export const adminReportSchema = z.enum(ADMIN_REPORTS);
export const partnerReportSchema = z.enum(PARTNER_REPORTS);
export type AdminReport = z.infer<typeof adminReportSchema>;
export type PartnerReport = z.infer<typeof partnerReportSchema>;
export type ReportId = AdminReport | PartnerReport;

export const REPORT_LABELS: Record<ReportId, string> = {
  "sales-by-vendor": "Sales by vendor",
  "sales-by-venue": "Sales by venue",
  "sales-by-title": "Sales by movie / event",
  bookings: "Bookings (one row per booking)",
  payouts: "Payouts",
  invoices: "Subscription invoices",
};

/** Longest period one report covers. */
export const REPORT_MAX_DAYS = 366;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Query string of the report page and its CSV route; anything invalid is dropped (defaults apply). */
export const reportFiltersSchema = z.object({
  from: dateKey.optional().catch(undefined),
  to: dateKey.optional().catch(undefined),
  city: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional()
    .catch(undefined),
  vendor: objectIdSchema.optional().catch(undefined),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

/** Resolved filters a report runs with. */
export interface ReportFilters {
  fromKey: string;
  toKey: string;
  cityId?: string;
  vendorId?: string;
}

export type ReportColumnType = "text" | "int" | "money" | "date" | "datetime";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
  /** Summed in the totals row (int and money columns). */
  total?: boolean;
}

/** One row: money in paise, dates as ISO strings. */
export type ReportRow = Record<string, string | number | null | undefined>;
