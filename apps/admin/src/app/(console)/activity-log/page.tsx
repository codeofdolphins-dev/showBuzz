import type { Metadata } from "next";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listActivity, listActivityResources } from "@showbuzz/core/services/admin/activity-admin.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { activityActorTypeSchema } from "@showbuzz/schemas/activity-log";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { ActivityRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { dateParam, defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Activity Logs" };

const ACTOR_OPTIONS = [
  { value: "staff", label: "ShowBuzz staff" },
  { value: "vendor", label: "Vendors" },
];

const COLUMNS: DataTableColumn<ActivityRow>[] = [
  {
    key: "when",
    header: "Timestamp",
    sortField: "createdAt",
    cell: (a) => (
      <span className="whitespace-nowrap">
        <span className="block font-semibold">{formatDateShort(new Date(a.createdAt))}</span>
        <span className="block text-[11px] text-admin-subtle">{formatTime(new Date(a.createdAt))} IST</span>
      </span>
    ),
  },
  {
    key: "actor",
    header: "Operator",
    cell: (a) => (
      <span>
        <span className="block font-semibold">{a.actorName}</span>
        <StatusBadge tone={a.actorType === "staff" ? "indigo" : "info"}>
          {a.actorType === "staff" ? "Staff" : "Vendor"}
        </StatusBadge>
      </span>
    ),
  },
  { key: "vendor", header: "Vendor", cell: (a) => <span className="text-[11px]">{a.vendorName ?? "—"}</span> },
  {
    key: "action",
    header: "Action",
    cell: (a) => (
      <span>
        <span className="block font-mono text-[11px] font-bold">{a.action}</span>
        <span className="block text-[10px] text-admin-subtle">{a.resource.replace(/[_-]/g, " ")}</span>
      </span>
    ),
  },
  {
    key: "details",
    header: "Details",
    cell: (a) => (
      <span className="block max-w-md">
        <span className="block">{a.summary}</span>
        {a.changedFields.length ? (
          <span className="block text-[10px] text-admin-subtle">Fields: {a.changedFields.join(", ")}</span>
        ) : null}
      </span>
    ),
  },
  { key: "ip", header: "IP prefix", cell: (a) => <span className="font-mono text-[11px]">{a.ipPrefix ?? "—"}</span> },
];

/** Prototype activity-log.html: every back-office change by staff and vendors (field names only, never values). */
export default async function ActivityLogPage({ searchParams }: PageProps<"/activity-log">) {
  const { staff } = await requireStaffPage("/activity-log");
  if (!hasPermission(staff.permissions, "activity-log:read")) return <NoAccess title="Activity Logs" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: ["createdAt"],
    defaultSort: { field: "createdAt", direction: "desc" },
    defaultLimit: 50,
  });
  const [result, vendors, resources] = await Promise.all([
    load(() =>
      listActivity({
        ...params,
        ...defined({
          actorType: enumParam(sp, "actor", activityActorTypeSchema),
          vendorId: param(sp, "vendor"),
          resource: param(sp, "resource"),
          fromDate: dateParam(sp, "from"),
          toDate: dateParam(sp, "to"),
        }),
      }),
    ),
    connect()
      .then(() => listVendorOptions())
      .catch(() => []),
    listActivityResources().catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Audit Trail & Security Activity Logs"
        crumb="Activity Logs"
        subtitle="Who changed what, when and from where. Entries can't be edited or deleted; values (KYC, bank details, prices) are never logged."
      />
      <FilterBar
        searchPlaceholder="Search summary or action…"
        filters={[
          { name: "actor", label: "Actor", options: ACTOR_OPTIONS },
          { name: "vendor", label: "Vendor", options: vendors, allLabel: "All vendors" },
          { name: "resource", label: "Module", options: resources },
        ]}
        actions={<DateRangeFilter />}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(a) => a.id}
          total={result.data.total}
          params={params}
          pathname="/activity-log"
          searchParams={sp}
          caption="Activity log"
          empty={<EmptyState title="Nothing logged here" description="Try other filters or dates." />}
        />
      )}
    </>
  );
}
