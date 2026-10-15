import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus, ShieldCheck } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { STAFF_LIST_SORT, listRoles, listStaff } from "@showbuzz/core/services/admin/staff-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { staffStatusSchema } from "@showbuzz/schemas/staff";
import type { StaffRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Staff & Operators" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const when = (iso?: string) => (iso ? `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}` : "Never");

const COLUMNS: DataTableColumn<StaffRow>[] = [
  {
    key: "operator",
    header: "Operator",
    sortField: "name",
    cell: (s) => (
      <span>
        <Link href={`/users/${s.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
          {s.name}
        </Link>
        <span className="block text-[11px] text-admin-subtle">{s.email}</span>
      </span>
    ),
  },
  { key: "role", header: "Role", cell: (s) => <StatusBadge tone="indigo">{s.roleName}</StatusBadge> },
  { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
  { key: "last", header: "Last sign-in", sortField: "lastLoginAt", cell: (s) => when(s.lastLoginAt) },
];

/** Prototype users.html: the platform team's accounts (vendors have their own partner logins). */
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { staff } = await requireStaffPage("/users");
  if (!hasPermission(staff.permissions, "users:read")) return <NoAccess title="Staff & Operators" />;
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: STAFF_LIST_SORT, defaultSort: { field: "name", direction: "asc" } });
  const [result, roles] = await Promise.all([
    load(() =>
      listStaff({
        ...params,
        ...defined({ roleId: param(sp, "role"), status: enumParam(sp, "status", staffStatusSchema) }),
      }),
    ),
    listRoles().catch(() => []),
  ]);
  const canWrite = hasPermission(staff.permissions, "users:write");

  return (
    <>
      <PageHeader
        title="Staff & Box Office Operators"
        crumb="Staff & Operators"
        subtitle="The ShowBuzz team's console accounts. Accounts are disabled, never deleted (the activity log keeps their name)."
        actions={
          <div className="flex gap-2">
            {hasPermission(staff.permissions, "roles:read") ? (
              <LinkButton href="/roles" variant="secondary">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Permission matrix
              </LinkButton>
            ) : null}
            {canWrite ? (
              <LinkButton href="/users/new">
                <Plus className="h-4 w-4" aria-hidden /> Add staff
              </LinkButton>
            ) : null}
          </div>
        }
      />
      <FilterBar
        searchPlaceholder="Search name or email…"
        filters={[
          { name: "role", label: "Role", options: roles.map((r) => ({ value: r.id, label: r.name })) },
          { name: "status", label: "Status", options: STATUS_OPTIONS },
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
          pathname="/users"
          searchParams={sp}
          caption="Staff"
          rowActions={(s) => (
            <Link
              href={`/users/${s.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${s.name}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No staff match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
