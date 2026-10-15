import type { Metadata } from "next";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { PAYMENT_SORT_FIELDS, listRefunds } from "@showbuzz/core/services/admin/payments-admin.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminRefundRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { ProviderBadge } from "@/components/billing/ProviderBadge";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Refunds" };

const STATUS_OPTIONS = [
  { value: "processed", label: "Processed" },
  { value: "processing", label: "Processing" },
];
const PROVIDER_OPTIONS = [
  { value: "razorpay", label: "Razorpay" },
  { value: "simulated", label: "Simulated gateway" },
  { value: "counter", label: "Counter" },
];

function reasonLabel(r: AdminRefundRow): string {
  if (r.reason === "booking_failed") return "Booking couldn't be completed";
  const who = r.cancelledBy === "vendor" ? "Cancelled by vendor" : "Cancelled by customer";
  return r.cancelReason ? `${who}: ${r.cancelReason}` : who;
}

const COLUMNS: DataTableColumn<AdminRefundRow>[] = [
  {
    key: "booking",
    header: "Booking",
    cell: (r) => (
      <span>
        <span className="block font-mono font-bold">{r.bookingCode}</span>
        <span className="block text-[10px] text-admin-subtle">{formatDateShort(new Date(r.createdAt))}</span>
      </span>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    cell: (r) => (
      <span>
        <span className="block font-semibold">{r.customerName}</span>
        <span className="block text-[11px] text-admin-subtle">{r.vendorName}</span>
      </span>
    ),
  },
  {
    key: "original",
    header: "Original",
    className: "text-right",
    cell: (r) => <span className="font-mono">{formatINR(r.originalPaise)}</span>,
  },
  {
    key: "refund",
    header: "Refunded",
    sortField: "amountPaise",
    className: "text-right",
    cell: (r) => (
      <span className="font-mono font-bold">
        {formatINR(r.amountPaise)}
        {r.giftCardPaise ? (
          <span className="block text-[10px] font-normal text-admin-subtle">
            + {formatINR(r.giftCardPaise)} to gift card
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: "fee",
    header: "Fee kept",
    className: "text-right",
    cell: (r) => <span className="font-mono">{formatINR(r.feePaise)}</span>,
  },
  { key: "reason", header: "Reason", cell: (r) => <span className="text-[11px]">{reasonLabel(r)}</span> },
  {
    key: "status",
    header: "Status",
    cell: (r) => (
      <span className="space-y-1">
        <StatusBadge status={r.status} />
        <ProviderBadge provider={r.provider} />
      </span>
    ),
  },
];

/**
 * Refunds (prototype refunds.html). They happen automatically when a customer or vendor cancels (policy decides the
 * fee) or when a paid order can't be completed; this list is for reconciliation.
 */
export default async function RefundsPage({ searchParams }: PageProps<"/refunds">) {
  const { staff } = await requireStaffPage("/refunds");
  if (!hasPermission(staff.permissions, "refunds:read")) return <NoAccess title="Refunds" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: PAYMENT_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const filters = {
    vendorId: param(sp, "vendor"),
    status: param(sp, "status"),
    provider: param(sp, "provider"),
    fromDate: param(sp, "from"),
    toDate: param(sp, "to"),
  };
  const [result, vendors] = await Promise.all([
    load(() =>
      listRefunds({ ...params, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => Boolean(v))) }),
    ),
    connect()
      .then(() => listVendorOptions())
      .catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Customer Refunds & Cancellations"
        crumb="Refunds"
        subtitle="Refunds follow each vendor's cancellation policy and are sent back automatically: online ones through Razorpay, counter ones in cash at the counter."
      />
      {result.ok ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <b>Simulated gateway:</b> no real money moved. Refunded for these filters:{" "}
          {formatINR(result.data.refundedPaise)}.
        </p>
      ) : null}
      <FilterBar
        searchPlaceholder="Booking code, customer or reference…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "provider", label: "Channel", options: PROVIDER_OPTIONS },
          { name: "vendor", label: "Vendor", options: vendors, allLabel: "All vendors" },
        ]}
        actions={<DateRangeFilter />}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(r) => r.id}
          total={result.data.total}
          params={params}
          pathname="/refunds"
          searchParams={sp}
          caption="Refunds"
          empty={<EmptyState title="No refunds match" description="Try another filter or date range." />}
        />
      )}
    </>
  );
}
