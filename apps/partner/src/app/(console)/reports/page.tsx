import type { Metadata } from "next";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { ReportFilterForm, ReportTable } from "@showbuzz/console-ui/ReportView";
import { buildHref, param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVendorReportCities, partnerReport } from "@showbuzz/core/services/partner/report.service";
import { previewReport, resolveReportFilters } from "@showbuzz/core/services/report-engine";
import {
  PARTNER_REPORTS,
  REPORT_LABELS,
  REPORT_MAX_DAYS,
  partnerReportSchema,
  type ReportFilters,
} from "@showbuzz/schemas/report";
import { addDaysToKey, istDateKey } from "@showbuzz/utils/dates";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Reports" };

/**
 * The vendor's own reports: sales by venue and by movie/event, every booking, and payouts, for a period and city.
 * Scoped to the session's vendor. Export CSV streams every row from /api/v1/partner/reports/<report>.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { vendor } = await requireVendorPage("/reports");
  const sp = await searchParams;
  const report = partnerReportSchema.catch("sales-by-venue").parse(param(sp, "report"));
  const now = new Date();
  const raw = { from: param(sp, "from"), to: param(sp, "to"), city: param(sp, "city") };

  let filters: ReportFilters;
  let rangeError = false;
  try {
    filters = resolveReportFilters(raw, now);
  } catch {
    rangeError = true;
    const today = istDateKey(now);
    filters = { fromKey: addDaysToKey(today, -29), toKey: today };
  }
  const [result, cities] = await Promise.all([
    rangeError
      ? null
      : load(async () => {
          const definition = await partnerReport(vendor.id, report, filters);
          return { definition, preview: await previewReport(definition) };
        }),
    listVendorReportCities(vendor.id).catch(() => []),
  ]);
  const query = { from: filters.fromKey, to: filters.toKey, ...(filters.cityId ? { city: filters.cityId } : {}) };

  return (
    <>
      <PageHeader
        title="Reports"
        crumb="Reports"
        subtitle="Your sales by venue and by movie/event, every booking, and your payouts. Export any report as CSV."
      />
      <ReportFilterForm
        reports={PARTNER_REPORTS.map((r) => ({ value: r, label: REPORT_LABELS[r] }))}
        report={report}
        fromKey={filters.fromKey}
        toKey={filters.toKey}
        cities={cities}
        {...(filters.cityId ? { cityId: filters.cityId } : {})}
        exportHref={buildHref(`/api/v1/partner/reports/${report}`, {}, query)}
        maxDays={REPORT_MAX_DAYS}
      />
      {rangeError ? (
        <TableError message={`Choose a date range of up to ${REPORT_MAX_DAYS} days, with "From" before "To".`} />
      ) : !result?.ok ? (
        <TableError message="The report couldn't be loaded. Try again or narrow the dates." />
      ) : (
        <ReportTable
          title={result.data.definition.title}
          columns={result.data.definition.columns}
          {...result.data.preview}
        />
      )}
      <p className="text-[11px] text-admin-subtle">
        {report === "payouts"
          ? "Payouts ShowBuzz created in the period (pending and paid)."
          : report === "bookings"
            ? vendor.shareCustomerContact
              ? "Customer contact details are included because ShowBuzz shares them with your account."
              : "Online customers' contact details are not shared with your account; counter sales show the walk-in details you entered."
            : "Sales are tickets + food before fees, including bookings cancelled later (see Refunds); your share and tickets count bookings still confirmed."}
      </p>
    </>
  );
}
