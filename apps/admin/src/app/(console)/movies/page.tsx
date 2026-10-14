import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { MOVIE_SORT_FIELDS, listMoviesAdmin } from "@showbuzz/core/services/admin/movie-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminMovieRow } from "@showbuzz/schemas/types/admin-marketplace";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Movies Catalog" };

const STATUS_OPTIONS = [
  { value: "now-showing", label: "Now showing" },
  { value: "upcoming", label: "Upcoming" },
];
const CREATOR_OPTIONS = [
  { value: "platform", label: "ShowBuzz" },
  { value: "vendor", label: "A vendor" },
];
const ARCHIVE_OPTIONS = [{ value: "yes", label: "Merged (archived)" }];

const COLUMNS: DataTableColumn<AdminMovieRow>[] = [
  {
    key: "title",
    header: "Film",
    sortField: "title",
    cell: (m) => (
      <span className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue URLs (vendor-supplied too) */}
        <img src={m.poster} alt="" className="h-12 w-8 shrink-0 rounded border border-admin-border object-cover" />
        <span>
          <Link href={`/movies/${m.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
            {m.title}
          </Link>
          <span className="block text-[11px] text-admin-subtle">{m.languages.join(", ")}</span>
        </span>
      </span>
    ),
  },
  { key: "release", header: "Release", sortField: "releaseDate", cell: (m) => m.releaseDate },
  { key: "creator", header: "Added by", cell: (m) => <span className="text-[11px]">{m.createdBy}</span> },
  { key: "vendors", header: "Vendors listing it", cell: (m) => m.vendors },
  { key: "shows", header: "Upcoming shows", cell: (m) => m.upcomingShows },
  {
    key: "status",
    header: "Status",
    cell: (m) =>
      m.archived ? (
        <span>
          <StatusBadge status="archived" />
          {m.mergedIntoTitle ? (
            <span className="block text-[10px] text-admin-subtle">Merged into {m.mergedIntoTitle}</span>
          ) : null}
        </span>
      ) : (
        <StatusBadge tone={m.status === "now-showing" ? "success" : "info"}>
          {m.status === "now-showing" ? "Now showing" : "Upcoming"}
        </StatusBadge>
      ),
  },
];

/**
 * The shared film catalogue (one public page per film, every vendor's cinemas on it). Duplicates created by
 * different vendors are merged from a film's page.
 */
export default async function MoviesPage({ searchParams }: PageProps<"/movies">) {
  const { staff } = await requireStaffPage("/movies");
  if (!hasPermission(staff.permissions, "movies:read")) return <NoAccess title="Movies Catalog" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: MOVIE_SORT_FIELDS,
    defaultSort: { field: "title", direction: "asc" },
  });
  const status = param(sp, "status");
  const creator = param(sp, "creator");
  const result = await load(() =>
    listMoviesAdmin(
      {
        ...params,
        ...(status === "now-showing" || status === "upcoming" ? { status } : {}),
        ...(creator === "platform" || creator === "vendor" ? { creator } : {}),
        archived: param(sp, "archived") === "yes",
      },
      new Date(),
    ),
  );

  return (
    <>
      <PageHeader
        title="Movies Catalog"
        crumb="Movies Catalog"
        subtitle="Every film on ShowBuzz, from the platform catalogue and from vendors. Open a duplicate to merge it into the film to keep."
      />
      <FilterBar
        searchPlaceholder="Search title or slug…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "creator", label: "Added by", options: CREATOR_OPTIONS, allLabel: "Anyone" },
          { name: "archived", label: "Show", options: ARCHIVE_OPTIONS, allLabel: "Active films" },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(m) => m.id}
          total={result.data.total}
          params={params}
          pathname="/movies"
          searchParams={sp}
          caption="Movies"
          rowActions={(m) => (
            <Link
              href={`/movies/${m.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${m.title}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No films match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
