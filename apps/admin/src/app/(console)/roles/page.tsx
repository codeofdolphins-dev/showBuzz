import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listRoles } from "@showbuzz/core/services/admin/staff-admin.service";
import { PERMISSION_GROUPS, hasPermission } from "@showbuzz/schemas/permissions";
import type { RoleRow } from "@showbuzz/schemas/types/admin-platform";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Role Permissions" };

const MODULES = PERMISSION_GROUPS.flatMap((g) => g.resources.map((r) => r.id));

function summary(role: RoleRow): string {
  if (role.locked) return "Every permission";
  const manage = MODULES.filter((m) => role.permissions.includes(`${m}:write`)).length;
  const view = MODULES.filter((m) => role.permissions.includes(`${m}:read`)).length - manage;
  return `Manages ${manage} module${manage === 1 ? "" : "s"} · views ${view} more`;
}

const COLUMNS: DataTableColumn<RoleRow>[] = [
  {
    key: "role",
    header: "Role",
    cell: (r) => (
      <span>
        <Link href={`/roles/${r.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
          {r.name}
        </Link>
        <span className="block max-w-md text-[11px] text-admin-subtle">{r.description}</span>
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    cell: (r) =>
      r.isSystem ? (
        <StatusBadge tone="indigo">{r.customised ? "System (edited)" : "System"}</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Custom</StatusBadge>
      ),
  },
  { key: "access", header: "Access", cell: (r) => <span className="text-[11px]">{summary(r)}</span> },
  { key: "staff", header: "Staff", className: "text-right", cell: (r) => r.staff },
];

/** Prototype roles.html: the platform team's roles and their permission matrix. */
export default async function RolesPage({ searchParams }: PageProps<"/roles">) {
  const { staff } = await requireStaffPage("/roles");
  if (!hasPermission(staff.permissions, "roles:read")) return <NoAccess title="Role Permissions" />;
  const sp = await searchParams;
  const result = await load(listRoles);
  const canWrite = hasPermission(staff.permissions, "roles:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Role Permissions & RBAC Matrix"
        crumb="Role Permissions"
        subtitle="Roles for the ShowBuzz team. Vendors manage venues, shows and gate scanning in the partner portal, so those aren't here."
        actions={
          canWrite ? (
            <LinkButton href="/roles/new">
              <Plus className="h-4 w-4" aria-hidden /> New role
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
          rowKey={(r) => r.id}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "name", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/roles"
          searchParams={sp}
          caption="Roles"
          rowActions={(r) => (
            <Link
              href={`/roles/${r.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${r.name}`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No roles yet" description="Run pnpm db:seed-roles." />}
        />
      )}
    </>
  );
}
