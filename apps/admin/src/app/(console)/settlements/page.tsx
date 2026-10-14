import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { SETTLEMENT_SORT_FIELDS, listSettlements } from "@showbuzz/core/services/admin/settlement.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { SettlementRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { signedINR } from "@/components/billing/SettlementLines";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Vendor Payouts" };

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const COLUMNS: DataTableColumn<SettlementRow>[] = [
  {
    key: "code",
    header: "Settlement ID",
    cell: (s) => (
      <Link href={`/settlements/${s.id}`} className="font-mono font-bold text-admin-indigo hover:underline">
        {s.code}
      </Link>
    ),
  },
  {
    key: "vendor",
    header: "Vendor",
    cell: (s) => (
      <Link href={`/vendors/${s.vendorId}`} className="font-semibold text-admin-dark hover:text-admin-indigo">
        {s.vendorName}
      </Link>
    ),
  },
  {
    key: "gross",
    header: "Gross sales",
    className: "text-right",
    cell: (s) => <span className="font-mono">{formatINR(s.grossSalesPaise)}</span>,
  },
  {
    key: "commission",
    header: "Commission",
    className: "text-right",
    cell: (s) => <span className="font-mono">{formatINR(s.commissionPaise)}</span>,
  },
  {
    key: "net",
    header: "Net payout",
    sortField: "netPayoutPaise",
    className: "text-right",
    cell: (s) => <span className="font-mono font-bold">{signedINR(s.netPayoutPaise)}</span>,
  },
  {
    key: "period",
    header: "Cycle period",
    sortField: "periodTo",
    cell: (s) => (
      <span className="whitespace-nowrap">
        {formatDateShort(new Date(s.periodFrom))} – {s.periodToKey}
        <span className="block text-[10px] text-admin-subtle">{s.bookings} bookings</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Payout status",
    cell: (s) => (
      <span>
        <StatusBadge status={s.status} />
        {s.reference ? <span className="block text-[10px] text-admin-subtle">UTR {s.reference}</span> : null}
      </span>
    ),
  },
];

/** Vendor payouts (prototype settlements.html): what each vendor is owed per cycle, and whether it was paid. */
export default async function SettlementsPage({ searchParams }: PageProps<"/settlements">) {
  const { staff } = await requireStaffPage("/settlements");
  if (!hasPermission(staff.permissions, "settlements:read")) return <NoAccess title="Vendor Payouts" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: SETTLEMENT_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const status = param(sp, "status");
  const vendorId = param(sp, "vendor");
  const [result, vendors] = await Promise.all([
    load(() =>
      listSettlements({
        ...params,
        ...(vendorId ? { vendorId } : {}),
        ...(status === "pending" || status === "paid" || status === "void" ? { status } : {}),
      }),
    ),
    connect()
      .then(() => listVendorOptions())
      .catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Vendor Payouts"
        crumb="Vendor Payouts"
        subtitle="Net vendor earnings per cycle: shows already held, commission retained, counter sales and cancellations adjusted."
        actions={
          hasPermission(staff.permissions, "settlements:write") ? (
            <LinkButton href="/settlements/new">
              <Plus className="h-4 w-4" aria-hidden /> Run payout
            </LinkButton>
          ) : null
        }
      />
      {result.ok && result.data.pendingTotalPaise !== 0 ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {signedINR(result.data.pendingTotalPaise)} in payouts is waiting to be transferred.
        </p>
      ) : null}
      <FilterBar
        searchPlaceholder="Settlement ID…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "vendor", label: "Vendor", options: vendors, allLabel: "All vendors" },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(s) => s.id}
          total={result.data.total}
          params={params}
          pathname="/settlements"
          searchParams={sp}
          caption="Vendor payouts"
          rowActions={(s) => (
            <Link
              href={`/settlements/${s.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${s.code}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No payouts yet" description="Run a payout for a vendor and period." />}
        />
      )}
    </>
  );
}
