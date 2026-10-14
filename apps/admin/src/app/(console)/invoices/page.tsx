import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { INVOICE_SORT_FIELDS, listInvoices } from "@showbuzz/core/services/admin/invoice.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { InvoiceRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { markInvoicePaidAction, voidInvoiceAction } from "@/app/_actions/billing";
import { GenerateInvoices } from "@/components/billing/GenerateInvoices";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { load } from "@/lib/load";
import { billingMonthOptions, currentBillingMonth } from "@/lib/months";

export const metadata: Metadata = { title: "Subscription Invoices" };

const STATUS_OPTIONS = [
  { value: "issued", label: "Issued (unpaid)" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const COLUMNS: DataTableColumn<InvoiceRow>[] = [
  { key: "code", header: "Invoice", cell: (i) => <span className="font-mono font-bold">{i.code}</span> },
  {
    key: "vendor",
    header: "Vendor",
    cell: (i) => (
      <Link href={`/vendors/${i.vendorId}`} className="font-semibold text-admin-dark hover:text-admin-indigo">
        {i.vendorName}
      </Link>
    ),
  },
  { key: "month", header: "Month", sortField: "month", cell: (i) => i.month },
  { key: "plan", header: "Plan", cell: (i) => <span className="text-[11px]">{i.planName}</span> },
  {
    key: "amount",
    header: "Amount",
    sortField: "amountPaise",
    className: "text-right",
    cell: (i) => <span className="font-mono font-bold">{formatINR(i.amountPaise)}</span>,
  },
  {
    key: "due",
    header: "Due",
    sortField: "dueAt",
    cell: (i) => (
      <span className={i.overdue ? "font-bold text-admin-danger" : undefined}>
        {formatDateShort(new Date(i.dueAt))}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (i) => (
      <span>
        <StatusBadge status={i.overdue ? "overdue" : i.status} />
        {i.reference ? <span className="block text-[10px] text-admin-subtle">Ref {i.reference}</span> : null}
      </span>
    ),
  },
];

/**
 * Monthly plan invoices for subscription vendors, marked paid by hand (no online payment until a gateway is chosen).
 * `?status=overdue` is the overdue view: unpaid past the due date.
 */
export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const { staff } = await requireStaffPage("/invoices");
  if (!hasPermission(staff.permissions, "invoices:read")) return <NoAccess title="Subscription Invoices" />;
  const sp = await searchParams;
  const now = new Date();
  const params = parseListParams(sp, {
    sortable: INVOICE_SORT_FIELDS,
    defaultSort: { field: "month", direction: "desc" },
  });
  const status = param(sp, "status");
  const month = param(sp, "month");
  const vendorId = param(sp, "vendor");
  const months = billingMonthOptions(now);
  const [result, vendors] = await Promise.all([
    load(() =>
      listInvoices(
        {
          ...params,
          ...(month ? { month } : {}),
          ...(vendorId ? { vendorId } : {}),
          ...(status === "overdue"
            ? { overdue: true }
            : status === "issued" || status === "paid" || status === "void"
              ? { status }
              : {}),
        },
        now,
      ),
    ),
    connect()
      .then(() => listVendorOptions({ billingModel: "subscription" }))
      .catch(() => []),
  ]);
  const canWrite = hasPermission(staff.permissions, "invoices:write");

  return (
    <>
      <PageHeader
        title="Subscription Invoices"
        crumb="Subscription Invoices"
        subtitle="One invoice per subscription vendor and month, due 7 days after it is issued. Record payments as they arrive."
        actions={canWrite ? <GenerateInvoices months={months} defaultMonth={currentBillingMonth(now)} /> : null}
      />
      {result.ok && result.data.overdueTotalPaise > 0 ? (
        <p role="status" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-admin-danger">
          {formatINR(result.data.overdueTotalPaise)} is overdue.{" "}
          <Link href="/invoices?status=overdue" className="font-bold underline">
            Show overdue invoices
          </Link>
          . A vendor that doesn&apos;t pay can be suspended from its vendor page.
        </p>
      ) : null}
      <FilterBar
        searchPlaceholder="Invoice number…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "month", label: "Month", options: months, allLabel: "All months" },
          { name: "vendor", label: "Vendor", options: vendors, allLabel: "All vendors" },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(i) => i.id}
          total={result.data.total}
          params={params}
          pathname="/invoices"
          searchParams={sp}
          caption="Subscription invoices"
          rowActions={
            canWrite
              ? (i) =>
                  i.status === "issued" ? (
                    <>
                      <PromptActionButton
                        label="Mark paid"
                        title={`Record payment of ${i.code}`}
                        description={`${i.vendorName} · ${formatINR(i.amountPaise)}`}
                        field={{ name: "reference", label: "Payment reference", placeholder: "UTR / receipt number" }}
                        confirmLabel="Mark paid"
                        action={markInvoicePaidAction.bind(null, i.id)}
                        success={`${i.code} marked paid.`}
                      />
                      <PromptActionButton
                        label="Void"
                        variant="ghost"
                        tone="danger"
                        title={`Void ${i.code}?`}
                        description="For an invoice raised in error. This can't be undone, and generating the month again won't re-issue it."
                        field={{ name: "reason", label: "Reason" }}
                        confirmLabel="Void invoice"
                        action={voidInvoiceAction.bind(null, i.id)}
                        success={`${i.code} voided.`}
                      />
                    </>
                  ) : null
              : undefined
          }
          empty={
            <EmptyState
              title="No invoices match"
              description="Generate a month's invoices once subscription vendors have a plan."
            />
          }
        />
      )}
    </>
  );
}
