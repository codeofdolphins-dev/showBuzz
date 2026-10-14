import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listPlans } from "@showbuzz/core/services/admin/plan.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { PlanRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatINR } from "@showbuzz/utils/money";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Subscription Plans" };

const COLUMNS: DataTableColumn<PlanRow>[] = [
  { key: "name", header: "Plan", cell: (p) => <span className="font-bold text-admin-dark">{p.name}</span> },
  {
    key: "fee",
    header: "Monthly fee",
    cell: (p) => <span className="font-mono font-bold">{formatINR(p.monthlyFeePaise)}</span>,
  },
  { key: "vendors", header: "Vendors on it", cell: (p) => p.vendors },
  { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.active ? "active" : "inactive"} /> },
];

/** Plans for subscription-billed vendors (a monthly invoice each; no commission). */
export default async function PlansPage({ searchParams }: PageProps<"/plans">) {
  const { staff } = await requireStaffPage("/plans");
  if (!hasPermission(staff.permissions, "plans:read")) return <NoAccess title="Subscription Plans" />;
  const sp = await searchParams;
  const result = await load(listPlans);
  const canWrite = hasPermission(staff.permissions, "plans:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        crumb="Subscription Plans"
        subtitle="Monthly plans for vendors billed by subscription instead of commission. Plans are switched off, never deleted."
        actions={
          canWrite ? (
            <LinkButton href="/plans/new">
              <Plus className="h-4 w-4" aria-hidden /> New plan
            </LinkButton>
          ) : null
        }
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(p) => p.id}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "name", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/plans"
          searchParams={sp}
          caption="Subscription plans"
          rowActions={
            canWrite
              ? (p) => (
                  <Link
                    href={`/plans/${p.id}/edit`}
                    className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Link>
                )
              : undefined
          }
          empty={
            <EmptyState title="No plans yet" description="Create a plan before moving a vendor to subscription." />
          }
        />
      )}
    </>
  );
}
