import "server-only";
import type { AdminReport, ReportFilters } from "@showbuzz/schemas/report";
import { REPORT_LABELS } from "@showbuzz/schemas/report";
import {
  INVOICE_COLUMNS,
  PAYOUT_COLUMNS,
  type ReportDefinition,
  STAFF_SALES_COLUMNS,
  invoiceRows,
  payoutRows,
  salesKeyColumns,
  salesRows,
} from "../report-engine";

/**
 * Platform-wide reports for the super-admin (all vendors; the vendor and city filters narrow them). Callers check
 * `reports:read`, plus `settlements:read` for payouts and `invoices:read` for invoices (REPORT_PERMISSIONS).
 */

export const ADMIN_REPORT_PERMISSIONS: Record<AdminReport, string[]> = {
  "sales-by-vendor": ["reports:read"],
  "sales-by-venue": ["reports:read"],
  "sales-by-title": ["reports:read"],
  payouts: ["reports:read", "settlements:read"],
  invoices: ["reports:read", "invoices:read"],
};

export function adminReport(report: AdminReport, filters: ReportFilters, now: Date): ReportDefinition {
  const title = REPORT_LABELS[report];
  switch (report) {
    case "sales-by-vendor":
      return {
        title,
        columns: [...salesKeyColumns("vendor", true), ...STAFF_SALES_COLUMNS],
        rows: () => salesRows("vendor", filters),
      };
    case "sales-by-venue":
      return {
        title,
        columns: [...salesKeyColumns("venue", true), ...STAFF_SALES_COLUMNS],
        rows: () => salesRows("venue", filters),
      };
    case "sales-by-title":
      return {
        title,
        columns: [...salesKeyColumns("title", true), ...STAFF_SALES_COLUMNS],
        rows: () => salesRows("title", filters),
      };
    case "payouts":
      return { title, columns: PAYOUT_COLUMNS(true), rows: () => payoutRows(filters, true) };
    case "invoices":
      return { title, columns: INVOICE_COLUMNS, rows: () => invoiceRows(filters, now) };
  }
}
