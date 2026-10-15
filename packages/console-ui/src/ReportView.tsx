import { Download } from "lucide-react";
import type { ReportColumn, ReportRow } from "@showbuzz/schemas/report";
import { cn } from "@showbuzz/utils/cn";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { EmptyState } from "./DataTable";

/**
 * Report page parts shared by the admin and partner consoles (prototype reports.html): a GET filter form (report,
 * dates, city and, for staff, vendor) with an "Export CSV" link to the same filters, and the result table with a
 * totals row. Server components: no client JavaScript needed.
 */

export interface ReportOption {
  value: string;
  label: string;
}

export function ReportFilterForm({
  reports,
  report,
  fromKey,
  toKey,
  cities,
  cityId,
  vendors,
  vendorId,
  exportHref,
  maxDays,
}: {
  reports: ReportOption[];
  report: string;
  fromKey: string;
  toKey: string;
  cities: ReportOption[];
  cityId?: string;
  /** Staff only. */
  vendors?: ReportOption[];
  vendorId?: string;
  exportHref: string;
  maxDays: number;
}) {
  const field = "rounded-md border border-admin-border bg-white px-2 py-1.5 text-base text-admin-text sm:text-xs";
  const label = "mb-1 block text-[11px] font-semibold text-admin-muted";
  return (
    <form
      method="get"
      className="grid grid-cols-1 gap-3 rounded-xl border border-admin-border bg-white p-4 shadow-card sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      <label className="block">
        <span className={label}>Report</span>
        <select name="report" defaultValue={report} className={cn(field, "w-full")}>
          {reports.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>From</span>
        <input type="date" name="from" defaultValue={fromKey} className={cn(field, "w-full")} />
      </label>
      <label className="block">
        <span className={label}>To</span>
        <input type="date" name="to" defaultValue={toKey} className={cn(field, "w-full")} />
      </label>
      <label className="block">
        <span className={label}>City</span>
        <select name="city" defaultValue={cityId ?? ""} className={cn(field, "w-full")}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {vendors ? (
        <label className="block">
          <span className={label}>Vendor</span>
          <select name="vendor" defaultValue={vendorId ?? ""} className={cn(field, "w-full lg:max-w-56")}>
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md border border-admin-indigo bg-admin-indigo px-4 py-1.5 text-xs font-bold text-white hover:bg-admin-dark"
        >
          Show report
        </button>
        <a
          href={exportHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-admin-border bg-white px-3 py-1.5 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </a>
      </div>
      <p className="text-[11px] text-admin-subtle sm:col-span-2 lg:basis-full">
        IST dates, up to {maxDays} days. Sales count bookings by the day they were paid for. The export uses the filters
        shown in the address bar: press &ldquo;Show report&rdquo; after changing them.
      </p>
    </form>
  );
}

function display(column: ReportColumn, value: ReportRow[string]): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.type) {
    case "money":
      return typeof value === "number" ? formatINR(value, { exact: true }) : "—";
    case "int":
      return typeof value === "number" ? value.toLocaleString("en-IN") : "—";
    case "date":
      return formatDateShort(new Date(value));
    case "datetime": {
      const date = new Date(value);
      return `${formatDateShort(date)}, ${formatTime(date)}`;
    }
    default:
      return String(value);
  }
}

const numeric = (c: ReportColumn) => c.type === "money" || c.type === "int";

export function ReportTable({
  title,
  columns,
  rows,
  totals,
  count,
  complete,
}: {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: Record<string, number>;
  count: number;
  complete: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState title="Nothing to report" description="No records match these filters. Try a wider date range." />
    );
  }
  const firstTotal = columns.findIndex((c) => c.total);
  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("px-4 py-2.5 font-bold whitespace-nowrap", numeric(c) && "text-right")}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {columns.map((c, j) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 whitespace-nowrap",
                      numeric(c) && "text-right font-mono",
                      j === 0 && "font-semibold text-admin-dark",
                    )}
                  >
                    {display(c, row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {firstTotal >= 0 ? (
            <tfoot className="border-t-2 border-admin-border bg-slate-50 font-bold text-admin-dark">
              <tr>
                {columns.map((c, j) => (
                  <td key={c.key} className={cn("px-4 py-2.5 whitespace-nowrap", numeric(c) && "text-right font-mono")}>
                    {c.total ? display(c, totals[c.key] ?? 0) : j === 0 ? "Total" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="border-t border-admin-border px-4 py-2 text-[11px] text-admin-muted">
        {complete
          ? rows.length < count
            ? `Showing ${rows.length} of ${count.toLocaleString("en-IN")} rows; totals cover all of them. Export CSV for every row.`
            : `${count.toLocaleString("en-IN")} row${count === 1 ? "" : "s"}.`
          : `Showing the first ${rows.length} rows; totals cover the first ${count.toLocaleString("en-IN")}. Export CSV for the full report or narrow the dates.`}
      </p>
    </div>
  );
}
