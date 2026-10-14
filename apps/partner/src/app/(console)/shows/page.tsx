import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Eye, Grid3x3, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVendorFixtureOptions } from "@showbuzz/core/services/partner/listing.service";
import { listVendorMovieOptions } from "@showbuzz/core/services/partner/movie.service";
import { SHOW_SORT_FIELDS, listVendorShows } from "@showbuzz/core/services/partner/show-schedule.service";
import { listVendorVenueOptions } from "@showbuzz/core/services/partner/venue.service";
import type { VendorShowRow } from "@showbuzz/schemas/types/partner-listing";
import { formatDateShort, formatTime, istDateKey, upcomingDays } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Shows" };

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
];
const iconLink = "rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo";

const STATUS_BADGE: Record<VendorShowRow["status"], { tone: "success" | "neutral" | "danger"; label: string }> = {
  scheduled: { tone: "success", label: "Scheduled" },
  started: { tone: "neutral", label: "Started" },
  cancelled: { tone: "danger", label: "Cancelled" },
};

const COLUMNS: DataTableColumn<VendorShowRow>[] = [
  {
    key: "title",
    header: "Movie / content",
    cell: (s) => (
      <Link href={`/shows/${s.id}`} className="hover:text-admin-indigo">
        <span className="block font-bold text-admin-dark">{s.title}</span>
        <span className="block text-[11px] text-admin-subtle">{s.kind === "movie" ? "Movie" : "Sports fixture"}</span>
      </Link>
    ),
  },
  {
    key: "venue",
    header: "Venue & screen",
    cell: (s) => (
      <>
        <span className="block font-semibold">{s.venueName}</span>
        <span className="block text-[11px] text-admin-subtle">{s.screenName}</span>
      </>
    ),
  },
  {
    key: "startsAt",
    header: "Date & time (IST)",
    sortField: "startsAt",
    cell: (s) => (
      <>
        <span className="block font-semibold">{formatDateShort(new Date(s.startsAt))}</span>
        <span className="block text-[11px] text-admin-subtle">
          {formatTime(new Date(s.startsAt))}
          {s.endsAt ? ` – ${formatTime(new Date(s.endsAt))}` : ""}
        </span>
      </>
    ),
  },
  {
    key: "format",
    header: "Format & audio",
    cell: (s) => [s.format, s.language].filter(Boolean).join(" · ") || "—",
  },
  {
    key: "occupancy",
    header: "Occupancy",
    cell: (s) => {
      const pct = s.capacity > 0 ? Math.round((s.sold / s.capacity) * 100) : 0;
      return (
        <span className="block min-w-24">
          <span className="font-semibold">
            {s.sold} / {s.capacity}
          </span>
          <span className="mt-1 block h-1.5 rounded-full bg-slate-100">
            <span className="block h-1.5 rounded-full bg-admin-indigo" style={{ width: `${pct}%` }} />
          </span>
        </span>
      );
    },
  },
  { key: "price", header: "Base price", sortField: "pricePaise", cell: (s) => formatINR(s.pricePaise) },
  {
    key: "status",
    header: "Status",
    cell: (s) => (
      <>
        <StatusBadge tone={STATUS_BADGE[s.status].tone}>{STATUS_BADGE[s.status].label}</StatusBadge>
        {s.generated ? <span className="mt-1 block text-[10px] text-admin-subtle">Demo (auto)</span> : null}
      </>
    ),
  },
];

/**
 * Prototype shows.html: the vendor's movie shows and sports fixtures, by IST date (from today on by default), venue,
 * film or fixture. Event passes are managed on their listing.
 */
export default async function ShowsPage({ searchParams }: PageProps<"/shows">) {
  const { vendor } = await requireVendorPage("/shows");
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: SHOW_SORT_FIELDS,
    defaultSort: { field: "startsAt", direction: "asc" },
    defaultLimit: 50,
  });
  const now = new Date();
  const dateKey = param(sp, "date");
  const validDate = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : undefined;
  const venueId = param(sp, "venue") || undefined;
  const movieId = param(sp, "movie") || undefined;
  const eventId = param(sp, "event") || undefined;
  const statusParam = param(sp, "status");
  const status = statusParam === "scheduled" || statusParam === "cancelled" ? statusParam : undefined;

  const [result, venues, movies, fixtures] = await Promise.all([
    load(() =>
      listVendorShows(
        vendor.id,
        {
          ...params,
          ...(validDate ? { dateKey: validDate } : {}),
          ...(venueId ? { venueId } : {}),
          ...(movieId ? { movieId } : {}),
          ...(eventId ? { eventId } : {}),
          ...(status ? { status } : {}),
        },
        now,
      ),
    ),
    listVendorVenueOptions(vendor.id).catch(() => []),
    listVendorMovieOptions(vendor.id).catch(() => []),
    listVendorFixtureOptions(vendor.id).catch(() => []),
  ]);
  const days = upcomingDays(istDateKey(now), 14).map((d) => ({
    value: d.key,
    label: `${d.dayLabel} ${d.dayOfMonth} ${d.monthLabel}`,
  }));
  if (validDate && !days.some((d) => d.value === validDate)) days.unshift({ value: validDate, label: validDate });
  const filtered = Boolean(params.q || validDate || venueId || movieId || eventId || status);

  return (
    <>
      <PageHeader
        title="Shows"
        crumb="Shows"
        subtitle="Your schedule. A screen runs one show at a time, with 15 minutes between shows."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/shows/bulk" variant="secondary">
              <CalendarRange className="h-4 w-4" aria-hidden /> Daily schedule
            </LinkButton>
            <LinkButton href="/shows/new">
              <Plus className="h-4 w-4" aria-hidden /> Schedule show
            </LinkButton>
          </div>
        }
      />
      <FilterBar
        searchPlaceholder="Search film, screen or format…"
        filters={[
          { name: "date", label: "Date", options: days, allLabel: "From today" },
          { name: "venue", label: "Venue", options: venues },
          { name: "movie", label: "Movie", options: movies.map((m) => ({ value: m.id, label: m.title })) },
          ...(fixtures.length > 0 ? [{ name: "event", label: "Fixture", options: fixtures }] : []),
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
          pathname="/shows"
          searchParams={sp}
          caption="Your shows"
          rowActions={(s) => (
            <>
              <Link href={`/shows/${s.id}`} className={iconLink} aria-label={`Open the ${s.title} show`}>
                <Eye className="h-4 w-4" aria-hidden />
              </Link>
              {s.status === "scheduled" ? (
                <Link
                  href={`/seat-layouts?tab=live&show=${s.id}&date=${istDateKey(new Date(s.startsAt))}`}
                  className={iconLink}
                  aria-label={`Seats of the ${s.title} show`}
                >
                  <Grid3x3 className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </>
          )}
          empty={
            <EmptyState
              title={filtered ? "No shows match" : "No upcoming shows"}
              description={filtered ? "Try another date or filter." : "Schedule your first show, or a daily schedule."}
            />
          }
        />
      )}
    </>
  );
}
