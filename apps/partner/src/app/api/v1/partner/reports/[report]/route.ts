import { z } from "zod";
import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { AppError } from "@showbuzz/core/http/app-error";
import { csvResponse } from "@showbuzz/core/http/csv-response";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { partnerReport } from "@showbuzz/core/services/partner/report.service";
import { resolveReportFilters } from "@showbuzz/core/services/report-engine";
import { partnerReportSchema, reportFiltersSchema } from "@showbuzz/schemas/report";
import { actorOf } from "@/lib/actor";

/**
 * CSV export of the signed-in vendor's own report (`?from=&to=&city=`, IST dates, up to 366 days), streamed row by
 * row. The vendor comes from the session; a `vendor` query parameter is ignored. Customer contact columns follow
 * `shareCustomerContact` (see partner/report.service.ts). Every export is recorded in the activity log.
 */
export const GET = apiHandler(
  { params: z.object({ report: partnerReportSchema }), query: reportFiltersSchema },
  async ({ params, query }) => {
    const current = await requireVendor();
    if (current.vendor.onboardingStatus !== "complete") {
      throw new AppError("ONBOARDING_INCOMPLETE", "Finish onboarding first.", 403);
    }
    const filters = resolveReportFilters({ ...query, vendor: undefined }, new Date());
    const report = await partnerReport(current.vendor.id, params.report, filters);
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
