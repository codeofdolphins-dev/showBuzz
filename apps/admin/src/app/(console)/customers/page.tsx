import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { CUSTOMER_SORT_FIELDS, listCustomers } from "@showbuzz/core/services/admin/customer-admin.service";
import { customerStatusFilterSchema } from "@showbuzz/schemas/admin-platform";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { CustomerRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Customers Database" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "deleted", label: "Deleted (anonymised)" },
];

const COLUMNS: DataTableColumn<CustomerRow>[] = [
  {
    key: "name",
    header: "Customer name",
    sortField: "name",
    cell: (c) => (
      <span>
        <Link href={`/customers/${c.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
          {c.name}
        </Link>
        <span className="block text-[11px] text-admin-subtle">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</span>
      </span>
    ),
  },
  { key: "joined", header: "Joined", sortField: "createdAt", cell: (c) => formatDateShort(new Date(c.joinedAt)) },
  { key: "orders", header: "Total orders", sortField: "orders", className: "text-right", cell: (c) => c.orders },
  {
    key: "spend",
    header: "Lifetime spend",
    sortField: "spend",
    className: "text-right",
    cell: (c) => <span className="font-mono font-bold">{formatINR(c.spendPaise)}</span>,
  },
  { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
];

/** Prototype customers.html: customer accounts with their bookings across every vendor (no loyalty tiers yet). */
export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { staff } = await requireStaffPage("/customers");
  if (!hasPermission(staff.permissions, "customers:read")) return <NoAccess title="Customers Database" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: CUSTOMER_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const result = await load(() =>
    listCustomers({ ...params, ...defined({ status: enumParam(sp, "status", customerStatusFilterSchema) }) }),
  );

  return (
    <>
      <PageHeader
        title="Registered Customers"
        crumb="Customers Database"
        subtitle="Orders and spend count bookings at every vendor. Spend is what's still paid (refunds excluded)."
      />
      <FilterBar
        searchPlaceholder="Search name, phone or email…"
        filters={[{ name: "status", label: "Status", options: STATUS_OPTIONS }]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(c) => c.id}
          total={result.data.total}
          params={params}
          pathname="/customers"
          searchParams={sp}
          caption="Customers"
          rowActions={(c) => (
            <Link
              href={`/customers/${c.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${c.name}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No customers match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
