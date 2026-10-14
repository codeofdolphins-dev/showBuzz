import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Eye, Pencil, Plus, Star } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import {
  MOVIE_SORT_FIELDS,
  listVendorMovieLanguages,
  listVendorMovies,
} from "@showbuzz/core/services/partner/movie.service";
import { movieStatusSchema } from "@showbuzz/schemas/movie";
import type { VendorMovieRow } from "@showbuzz/schemas/types/partner-listing";
import { formatDuration } from "@showbuzz/utils/dates";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Movies" };

const STATUS_OPTIONS = [
  { value: "now-showing", label: "Now showing" },
  { value: "upcoming", label: "Coming soon" },
];

const iconLink = "rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo";

const COLUMNS: DataTableColumn<VendorMovieRow>[] = [
  {
    key: "title",
    header: "Movie title",
    sortField: "title",
    cell: (m) => (
      <Link href={`/movies/${m.id}`} className="flex items-center gap-3 hover:text-admin-indigo">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue posters are arbitrary remote URLs */}
        <img src={m.poster} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
        <span>
          <span className="block font-bold text-admin-dark">{m.title}</span>
          <span className="block text-[11px] text-admin-subtle">{m.genres.join(", ")}</span>
        </span>
      </Link>
    ),
  },
  {
    key: "languages",
    header: "Language & formats",
    cell: (m) => (
      <>
        <span className="block font-semibold">{m.languages.join(", ")}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          {m.formats.map((f) => (
            <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-admin-muted">
              {f}
            </span>
          ))}
        </span>
      </>
    ),
  },
  { key: "certificate", header: "Certificate", cell: (m) => <StatusBadge tone="neutral">{m.certificate}</StatusBadge> },
  {
    key: "runtime",
    header: "Runtime",
    sortField: "durationMinutes",
    cell: (m) => formatDuration(m.durationMinutes),
  },
  { key: "release", header: "Release date", sortField: "releaseDate", cell: (m) => m.releaseDate },
  {
    key: "rating",
    header: "Rating",
    cell: (m) =>
      m.rating > 0 ? (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden /> {m.rating.toFixed(1)}
        </span>
      ) : (
        <span className="text-admin-subtle">Unrated</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    cell: (m) => (
      <StatusBadge tone={m.status === "now-showing" ? "success" : "warning"}>
        {m.status === "now-showing" ? "Now showing" : "Coming soon"}
      </StatusBadge>
    ),
  },
  {
    key: "owner",
    header: "Catalogue",
    cell: (m) => (
      <>
        <StatusBadge tone={m.own ? "indigo" : "neutral"}>{m.own ? "Added by you" : "Shared"}</StatusBadge>
        <span className="mt-1 block text-[11px] text-admin-subtle">
          {m.upcomingShows} upcoming show{m.upcomingShows === 1 ? "" : "s"}
        </span>
      </>
    ),
  },
];

/** Prototype movies.html: the films this vendor schedules (its "My movies" list over the shared catalogue). */
export default async function MoviesPage({ searchParams }: PageProps<"/movies">) {
  const { vendor } = await requireVendorPage("/movies");
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: MOVIE_SORT_FIELDS,
    defaultSort: { field: "title", direction: "asc" },
  });
  const status = movieStatusSchema.safeParse(param(sp, "status")).data;
  const language = param(sp, "language") || undefined;
  const now = new Date();

  const [result, languages] = await Promise.all([
    load(() =>
      listVendorMovies(vendor.id, { ...params, ...(status ? { status } : {}), ...(language ? { language } : {}) }, now),
    ),
    listVendorMovieLanguages(vendor.id).catch(() => []),
  ]);
  const filtered = Boolean(params.q || status || language);

  return (
    <>
      <PageHeader
        title="Movies"
        crumb="Movies"
        subtitle="Films you screen. Add them from the ShowBuzz catalogue, or create a film that isn't there yet."
        actions={
          <LinkButton href="/movies/add">
            <Plus className="h-4 w-4" aria-hidden /> Add movie
          </LinkButton>
        }
      />
      <FilterBar
        searchPlaceholder="Search title or genre…"
        filters={[
          { name: "language", label: "Language", options: languages.map((l) => ({ value: l, label: l })) },
          { name: "status", label: "Status", options: STATUS_OPTIONS },
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
          caption="Your movies"
          rowActions={(m) => (
            <>
              <Link href={`/movies/${m.id}`} className={iconLink} aria-label={`Open ${m.title}`}>
                <Eye className="h-4 w-4" aria-hidden />
              </Link>
              {m.own ? (
                <Link href={`/movies/${m.id}/edit`} className={iconLink} aria-label={`Edit ${m.title}`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              <Link href={`/shows/new?movie=${m.id}`} className={iconLink} aria-label={`Schedule ${m.title}`}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
              </Link>
            </>
          )}
          empty={
            <EmptyState
              title={filtered ? "No movies match" : "No movies yet"}
              description={
                filtered
                  ? "Try other filters."
                  : "Add the films you screen from the ShowBuzz catalogue to schedule shows."
              }
            />
          }
        />
      )}
    </>
  );
}
