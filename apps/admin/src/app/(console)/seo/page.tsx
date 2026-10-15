import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getSeoGlobalForm, listSeoEntries } from "@showbuzz/core/services/admin/content-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { SeoRow } from "@showbuzz/schemas/types/admin-platform";
import { deleteSeoEntryAction } from "@/app/_actions/marketing";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { SeoGlobalForm } from "@/components/content/SeoForms";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "SEO & Meta Tags" };

const COLUMNS: DataTableColumn<SeoRow>[] = [
  { key: "path", header: "Path", cell: (s) => <span className="font-mono text-[11px] font-bold">{s.path}</span> },
  {
    key: "title",
    header: "Title / description",
    cell: (s) => (
      <span className="block max-w-lg">
        <span className="block font-semibold">{s.title || "(page's own title)"}</span>
        <span className="block truncate text-[11px] text-admin-subtle">{s.description || "(page's own description)"}</span>
      </span>
    ),
  },
  {
    key: "flags",
    header: "Indexing",
    cell: (s) => (s.noindex ? <StatusBadge tone="warning">noindex</StatusBadge> : <StatusBadge status="active">Indexed</StatusBadge>),
  },
];

/** Prototype seo.html: site-wide defaults plus per-page / per-listing overrides of title, description and image. */
export default async function SeoPage({ searchParams }: PageProps<"/seo">) {
  const { staff } = await requireStaffPage("/seo");
  if (!hasPermission(staff.permissions, "seo:read")) return <NoAccess title="SEO & Meta Tags" />;
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: [], defaultSort: { field: "path", direction: "asc" } });
  const [global, entries] = await Promise.all([load(getSeoGlobalForm), load(() => listSeoEntries(params))]);
  const canWrite = hasPermission(staff.permissions, "seo:write");

  return (
    <>
      <PageHeader
        title="Search Engine Optimization & Meta Tags"
        crumb="SEO"
        subtitle="Changes reach showbuzz.com within a moment (cached pages are refreshed)."
      />
      <Card className="max-w-3xl space-y-3 p-6">
        <h2 className="text-sm font-bold text-admin-dark">Global search console directives</h2>
        {global.ok ? <SeoGlobalForm defaults={global.data} canWrite={canWrite} /> : <TableError />}
      </Card>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-admin-dark">Page and listing overrides</h2>
          {canWrite ? (
            <LinkButton href="/seo/new">
              <Plus className="h-4 w-4" aria-hidden /> Add override
            </LinkButton>
          ) : null}
        </div>
        <FilterBar searchPlaceholder="Search path or title…" />
        {!entries.ok ? (
          <TableError />
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={entries.data.rows}
            rowKey={(s) => s.id}
            total={entries.data.total}
            params={params}
            pathname="/seo"
            searchParams={sp}
            caption="SEO overrides"
            rowActions={
              canWrite
                ? (s) => (
                    <>
                      <Link
                        href={`/seo/${s.id}`}
                        className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                        aria-label={`Edit ${s.path}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <PromptActionButton
                        label="Remove"
                        title={`Remove the override for ${s.path}?`}
                        description="The page goes back to its own title and description."
                        confirmLabel="Remove"
                        tone="danger"
                        variant="ghost"
                        action={deleteSeoEntryAction.bind(null, s.id)}
                        success="Override removed."
                      />
                    </>
                  )
                : undefined
            }
            empty={
              <EmptyState
                title="No overrides yet"
                description="Every page uses its own title and description, with the global defaults as fallback."
              />
            }
          />
        )}
      </section>
    </>
  );
}
