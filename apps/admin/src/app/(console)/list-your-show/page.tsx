import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { SHOW_REQUEST_SORT_FIELDS, listShowRequests } from "@showbuzz/core/services/admin/show-request.service";
import { leadStatusSchema } from "@showbuzz/schemas/admin-marketplace";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { ShowRequestRow } from "@showbuzz/schemas/types/admin-marketplace";
import { formatDateShort } from "@showbuzz/utils/dates";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "List Your Show Requests" };

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "Under review" },
  { value: "closed", label: "Closed" },
];

function requestStatusBadge(r: Pick<ShowRequestRow, "status">) {
  if (r.status === "new") return <StatusBadge tone="indigo">New</StatusBadge>;
  if (r.status === "in_progress") return <StatusBadge tone="warning">Under review</StatusBadge>;
  return <StatusBadge tone="neutral">Closed</StatusBadge>;
}

const COLUMNS: DataTableColumn<ShowRequestRow>[] = [
  {
    key: "ref",
    header: "Request ID",
    sortField: "createdAt",
    cell: (r) => (
      <span>
        <Link href={`/list-your-show/${r.id}`} className="font-mono font-bold text-admin-indigo hover:underline">
          {r.reference}
        </Link>
        <span className="block text-[10px] text-admin-subtle">{formatDateShort(new Date(r.createdAt))}</span>
      </span>
    ),
  },
  {
    key: "category",
    header: "Company & category",
    cell: (r) => (
      <span>
        <span className="block font-bold text-admin-dark">{r.companyName}</span>
        <span className="block text-[11px] text-admin-subtle">{r.category}</span>
      </span>
    ),
  },
  {
    key: "contact",
    header: "Organiser contact",
    sortField: "name",
    cell: (r) => (
      <span>
        <span className="block font-semibold">{r.name}</span>
        <span className="block text-[11px] text-admin-subtle">{r.phone}</span>
      </span>
    ),
  },
  {
    key: "city",
    header: "City & capacity",
    cell: (r) => (
      <span className="text-[11px]">
        {r.city} · {r.capacity}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {requestStatusBadge(r)}
        {r.vendorId ? <StatusBadge tone="success">Vendor created</StatusBadge> : null}
      </span>
    ),
  },
];

/** Partner listing requests from showbuzz.com/list-your-show (prototype list-your-show.html). */
export default async function ListYourShowPage({ searchParams }: PageProps<"/list-your-show">) {
  const { staff } = await requireStaffPage("/list-your-show");
  if (!hasPermission(staff.permissions, "list-your-show:read")) return <NoAccess title="List Your Show Requests" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: SHOW_REQUEST_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const status = leadStatusSchema.safeParse(param(sp, "status"));
  const result = await load(() => listShowRequests({ ...params, ...(status.success ? { status: status.data } : {}) }));

  return (
    <>
      <PageHeader
        title="Partner Listing Requests"
        crumb="List Your Show Requests"
        subtitle="Organisers who asked to sell on ShowBuzz. Review them, keep notes, and create a vendor account when you're ready."
      />
      <FilterBar
        searchPlaceholder="Search reference, organiser, company or city…"
        filters={[{ name: "status", label: "Status", options: STATUS_OPTIONS }]}
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
          pathname="/list-your-show"
          searchParams={sp}
          caption="List your show requests"
          rowActions={(r) => (
            <Link
              href={`/list-your-show/${r.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${r.reference}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No requests match" description="New requests from the public form appear here." />}
        />
      )}
    </>
  );
}
