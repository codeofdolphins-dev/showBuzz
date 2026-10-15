import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { csvResponse } from "@showbuzz/core/http/csv-response";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { ADMIN_REPORT_PERMISSIONS, adminReport } from "@showbuzz/core/services/admin/report.service";
import { resolveReportFilters } from "@showbuzz/core/services/report-engine";
import { adminReportSchema, reportFiltersSchema } from "@showbuzz/schemas/report";
import { actorOf } from "@/lib/actor";

/**
 * CSV export of an admin report (`?from=&to=&city=&vendor=`, IST dates, up to 366 days). Streamed row by row.
 * Needs `reports:read`, plus `settlements:read` for payouts and `invoices:read` for invoices. Every export is
 * recorded in the activity log.
 */
export const GET = apiHandler(
  { params: z.object({ report: adminReportSchema }), query: reportFiltersSchema },
  async ({ params, query }) => {
    let current = await requirePermission("reports:read");
    for (const permission of ADMIN_REPORT_PERMISSIONS[params.report]) current = await requirePermission(permission);
    const now = new Date();
    const filters = resolveReportFilters(query, now);
    const report = adminReport(params.report, filters, now);
    await logActivity(actorOf(current), {
      action: "report_export",
      resource: "report",
      resourceId: params.report,
      summary: `Exported ${report.title} (${filters.fromKey} to ${filters.toKey})`,
      changedFields: [],
    });
    return csvResponse(
      `showbuzz-${params.report}-${filters.fromKey}-to-${filters.toKey}.csv`,
      report.columns,
      report.rows(),
    );
  },
);
