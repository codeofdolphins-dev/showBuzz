import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listGenresAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { GENRE_SCOPE_LABELS, genreScopeSchema } from "@showbuzz/schemas/master-data";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { GenreRow } from "@showbuzz/schemas/types/admin-platform";
import { moveGenreAction } from "@/app/_actions/master-data";
import { MoveButtons } from "@/components/common/MoveButtons";
import { enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Content Genres" };

const SCOPE_OPTIONS = Object.entries(GENRE_SCOPE_LABELS).map(([value, label]) => ({ value, label }));

const COLUMNS: DataTableColumn<GenreRow>[] = [
  { key: "name", header: "Genre name", cell: (g) => <span className="font-bold text-admin-dark">{g.name}</span> },
  { key: "slug", header: "Slug", cell: (g) => <span className="font-mono text-[11px]">{g.slug}</span> },
  {
    key: "scope",
    header: "Category",
    cell: (g) => <StatusBadge tone={g.appliesTo === "movie" ? "indigo" : "info"}>{GENRE_SCOPE_LABELS[g.appliesTo]}</StatusBadge>,
  },
  { key: "listings", header: "Listings", className: "text-right", cell: (g) => g.listings },
  { key: "status", header: "Status", cell: (g) => <StatusBadge status={g.status} /> },
];

/**
 * Prototype genres.html: movie genres and the categories of events, plays, sports and activities, offered by the
 * listing forms in both consoles. Ordering is per section (pick one to reorder).
 */
export default async function GenresPage({ searchParams }: PageProps<"/genres">) {
  const { staff } = await requireStaffPage("/genres");
  if (!hasPermission(staff.permissions, "genres:read")) return <NoAccess title="Content Genres" />;
  const sp = await searchParams;
  const scope = enumParam(sp, "scope", genreScopeSchema);
  const result = await load(() => listGenresAdmin(scope));
  const canWrite = hasPermission(staff.permissions, "genres:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Content Genres & Tags"
        crumb="Content Genres"
        subtitle="The first five movie genres (in order) are the home page's genre chips. Pick a section to change its order."
        actions={
          canWrite ? (
            <LinkButton href="/genres/new">
              <Plus className="h-4 w-4" aria-hidden /> Add genre
            </LinkButton>
          ) : null
        }
      />
      <FilterBar
        searchParam={null}
        filters={[{ name: "scope", label: "Section", options: SCOPE_OPTIONS, allLabel: "All sections" }]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(g) => g.id}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "sortOrder", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/genres"
          searchParams={sp}
          caption="Genres"
          rowActions={
            canWrite
              ? (g) => (
                  <>
                    {scope ? (
                      <MoveButtons
                        id={g.id}
                        label={g.name}
                        first={rows[0]?.id === g.id}
                        last={rows.at(-1)?.id === g.id}
                        action={moveGenreAction}
                      />
                    ) : null}
                    <Link
                      href={`/genres/${g.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${g.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </>
                )
              : undefined
          }
          empty={<EmptyState title="No genres here" description="Run pnpm db:seed or add one." />}
        />
      )}
    </>
  );
}
