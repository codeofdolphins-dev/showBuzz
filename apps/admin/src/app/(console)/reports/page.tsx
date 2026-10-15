import type { Metadata } from "next";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { ReportFilterForm, ReportTable } from "@showbuzz/console-ui/ReportView";
import { buildHref, param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ADMIN_REPORT_PERMISSIONS, adminReport } from "@showbuzz/core/services/admin/report.service";
import { cityNames, listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { previewReport, resolveReportFilters } from "@showbuzz/core/services/report-engine";
import { connect } from "@showbuzz/db/connect";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { ADMIN_REPORTS, REPORT_LABELS, REPORT_MAX_DAYS, type ReportFilters } from "@showbuzz/schemas/report";
import { addDaysToKey, istDateKey } from "@showbuzz/utils/dates";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Sales Reports" };

/**
 * Prototype reports.html: platform sales by vendor, venue or movie/event, payouts and subscription invoices for a
 * period, with city and vendor filters. The table previews the report; Export CSV streams every row from
 * /api/v1/admin/reports/<report> with the same filters.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { staff } = await requireStaffPage("/reports");
  if (!hasPermission(staff.permissions, "reports:read")) return <NoAccess title="Sales Reports" />;
  const sp = await searchParams;

  const allowed = ADMIN_REPORTS.filter((r) =>
    ADMIN_REPORT_PERMISSIONS[r].every((p) => hasPermission(staff.permissions, p)),
  );
  const requested = param(sp, "report");
  const report = allowed.find((r) => r === requested) ?? allowed[0] ?? "sales-by-vendor";
  const now = new Date();
  const raw = { from: param(sp, "from"), to: param(sp, "to"), city: param(sp, "city"), vendor: param(sp, "vendor") };

  let filters: ReportFilters;
  let rangeError = false;
  try {
    filters = resolveReportFilters(raw, now);
  } catch {
    rangeError = true;
    const today = istDateKey(now);
    filters = { fromKey: addDaysToKey(today, -29), toKey: today };
  }
  const definition = adminReport(report, filters, now);
  const [preview, options] = await Promise.all([
    rangeError ? null : load(() => previewReport(definition)),
    connect()
      .then(async () => ({ cities: await cityNames(), vendors: await listVendorOptions() }))
      .catch(() => ({ cities: new Map<string, string>(), vendors: [] })),
  ]);
  const query = {
    from: filters.fromKey,
    to: filters.toKey,
    ...(filters.cityId ? { city: filters.cityId } : {}),
    ...(filters.vendorId ? { vendor: filters.vendorId } : {}),
  };

  return (
    <>
      <PageHeader
        title="Box Office Sales & Revenue Reports"
        crumb="Reports"
        subtitle="Sales by vendor, venue and movie/event, vendor payouts and subscription invoices. Export any report as CSV."
      />
      <ReportFilterForm
        reports={allowed.map((r) => ({ value: r, label: REPORT_LABELS[r] }))}
        report={report}
        fromKey={filters.fromKey}
        toKey={filters.toKey}
        cities={[...options.cities.entries()]
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        {...(filters.cityId ? { cityId: filters.cityId } : {})}
        vendors={options.vendors}
        {...(filters.vendorId ? { vendorId: filters.vendorId } : {})}
        exportHref={buildHref(`/api/v1/admin/reports/${report}`, {}, query)}
        maxDays={REPORT_MAX_DAYS}
      />
      {rangeError ? (
        <TableError message={`Choose a date range of up to ${REPORT_MAX_DAYS} days, with "From" before "To".`} />
      ) : !preview?.ok ? (
        <TableError message="The report couldn't be loaded. Try again or narrow the filters." />
      ) : (
        <ReportTable title={definition.title} columns={definition.columns} {...preview.data} />
      )}
      {report === "payouts" || report === "invoices" ? (
        <p className="text-[11px] text-admin-subtle">
          {report === "payouts"
            ? "Payouts created in the period (pending and paid; voided payouts are left out). City = the vendor's business city."
            : "Invoices for the months the period touches. Void invoices count as zero. City = the vendor's business city."}
        </p>
      ) : (
        <p className="text-[11px] text-admin-subtle">
          Gross paid = what customers paid (tickets + food + fees + GST − discounts), including bookings cancelled later
          (see Refunds). Fees, commission, vendor share and tickets count bookings still confirmed. City = where the
          show took place. Gift card purchases are platform sales and are not included.
        </p>
      )}
    </>
  );
}
