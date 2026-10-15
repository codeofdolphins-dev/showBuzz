import type { Metadata } from "next";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { PAYMENT_SORT_FIELDS, listPayments } from "@showbuzz/core/services/admin/payments-admin.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminPaymentRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { ProviderBadge, methodLabel } from "@/components/billing/ProviderBadge";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Payment Gateway" };

const STATUS_OPTIONS = [
  { value: "succeeded", label: "Successful" },
  { value: "created", label: "Awaiting payment" },
  { value: "failed", label: "Failed" },
];
const PROVIDER_OPTIONS = [
  { value: "razorpay", label: "Razorpay" },
  { value: "simulated", label: "Simulated gateway" },
  { value: "counter", label: "Counter" },
];

const COLUMNS: DataTableColumn<AdminPaymentRow>[] = [
  {
    key: "ref",
    header: "Transaction",
    cell: (p) => (
      <span>
        <span className="block font-mono text-[11px] font-bold">{p.providerRef}</span>
        <span className="block text-[10px] text-admin-subtle">
          {formatDateShort(new Date(p.createdAt))}, {formatTime(new Date(p.createdAt))}
        </span>
      </span>
    ),
  },
  { key: "booking", header: "Booking", cell: (p) => <span className="font-mono font-bold">{p.bookingCode}</span> },
  {
    key: "customer",
    header: "Customer",
    cell: (p) => (
      <span>
        <span className="block font-semibold">{p.customerName}</span>
        <span className="block text-[11px] text-admin-subtle">{p.title}</span>
      </span>
    ),
  },
  { key: "vendor", header: "Vendor", cell: (p) => <span className="text-[11px]">{p.vendorName}</span> },
  {
    key: "amount",
    header: "Amount",
    sortField: "amountPaise",
    className: "text-right",
    cell: (p) => <span className="font-mono font-bold">{formatINR(p.amountPaise)}</span>,
  },
  {
    key: "method",
    header: "Method",
    cell: (p) => (
      <span className="space-y-1">
        <span className="block">{methodLabel(p.method)}</span>
        <ProviderBadge provider={p.provider} />
        {p.reference ? <span className="block text-[10px] text-admin-subtle">Ref {p.reference}</span> : null}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (p) => (
      <span>
        <StatusBadge status={p.status} />
        {p.failureReason ? <span className="block text-[10px] text-admin-subtle">{p.failureReason}</span> : null}
      </span>
    ),
  },
];

/** Every payment attempt (prototype payments.html). Online payments go through Razorpay. */
export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const { staff } = await requireStaffPage("/payments");
  if (!hasPermission(staff.permissions, "payments:read")) return <NoAccess title="Payment Gateway" />;
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
      listPayments({ ...params, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => Boolean(v))) }),
    ),
    connect()
      .then(() => listVendorOptions())
      .catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Payment Transactions"
        crumb="Payment Gateway"
        subtitle="Online payments run through Razorpay; counter sales are recorded by vendors. Older records show the gateway that took them."
      />
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <b>Simulated gateway:</b> no real money moved for online payments.
        {result.ok ? ` Successful payments matching these filters: ${formatINR(result.data.succeededPaise)}.` : ""}
      </p>
      <FilterBar
        searchPlaceholder="Booking code, customer or gateway ref…"
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
          rowKey={(p) => p.id}
          total={result.data.total}
          params={params}
          pathname="/payments"
          searchParams={sp}
          caption="Payments"
          empty={<EmptyState title="No payments match" description="Try another filter or date range." />}
        />
      )}
    </>
  );
}
