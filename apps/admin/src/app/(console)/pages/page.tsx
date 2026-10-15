import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { DataTable, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listSitePages } from "@showbuzz/core/services/admin/content-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { SitePageRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Website Pages" };

const COLUMNS: DataTableColumn<SitePageRow>[] = [
  { key: "name", header: "Page name", cell: (p) => <span className="font-bold text-admin-dark">{p.name}</span> },
  { key: "path", header: "URL slug", cell: (p) => <span className="font-mono text-[11px]">{p.path}</span> },
  {
    key: "status",
    header: "Status",
    cell: (p) =>
      p.usingDefault ? <StatusBadge tone="neutral">Built-in text</StatusBadge> : <StatusBadge status={p.status} />,
  },
  {
    key: "updated",
    header: "Last saved",
    cell: (p) =>
      p.updatedAt ? `${formatDateShort(new Date(p.updatedAt))}, ${formatTime(new Date(p.updatedAt))}` : "Never",
  },
];

/** Prototype pages.html: the static pages of showbuzz.com, edited as structured fields. */
export default async function SitePagesPage({ searchParams }: PageProps<"/pages">) {
  const { staff } = await requireStaffPage("/pages");
  if (!hasPermission(staff.permissions, "pages:read")) return <NoAccess title="Website Pages" />;
  const sp = await searchParams;
  const result = await load(listSitePages);
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Static Website Content Pages"
        crumb="Website Pages"
        subtitle="Headings, paragraphs and lists as fields (no rich-text editor). A page never saved, or saved as a draft, shows the built-in text."
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(p) => p.slug}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "name", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/pages"
          searchParams={sp}
          caption="Website pages"
          rowActions={(p) => (
            <Link
              href={`/pages/${p.slug}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Edit ${p.name}`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
          )}
        />
      )}
    </>
  );
}
