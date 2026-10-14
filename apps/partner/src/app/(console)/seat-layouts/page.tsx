import type { Metadata } from "next";
import Link from "next/link";
import { Grid3x3, LayoutGrid, ShieldAlert } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams, type SearchParamsRecord } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getShowSeatBoard, listVendorShowOptions } from "@showbuzz/core/services/partner/seat-management.service";
import { listVendorLayouts, listVendorVenueOptions } from "@showbuzz/core/services/partner/venue.service";
import type { VendorLayoutRow } from "@showbuzz/schemas/types/partner-venue";
import { isDateKey, istDateKey } from "@showbuzz/utils/dates";
import { ShowPicker } from "@/components/seats/ShowPicker";
import { load } from "@/lib/load";
import { ShowSeatBoard } from "@/components/seats/ShowSeatBoard";
import { priceRange } from "@/components/seats/seat-styles";

export const metadata: Metadata = { title: "Seat Layouts" };

const COLUMNS: DataTableColumn<VendorLayoutRow>[] = [
  {
    key: "screen",
    header: "Screen",
    cell: (s) => (
      <>
        <span className="font-bold text-admin-dark">{s.name}</span>
        <span className="block text-[11px] text-admin-subtle">{s.venueName}</span>
      </>
    ),
  },
  { key: "grid", header: "Grid", cell: (s) => <span className="font-mono">{s.rows} rows</span> },
  {
    key: "capacity",
    header: "Capacity",
    cell: (s) => (
      <>
        <span className="font-mono font-bold text-admin-dark">{s.capacity.toLocaleString("en-IN")} seats</span>
        <span className="block text-[10px] text-admin-subtle">
          {s.categories.map((c) => `${c.seats} ${c.name}`).join(" · ")}
        </span>
      </>
    ),
  },
  {
    key: "prices",
    header: "Default prices",
    cell: (s) => <span className="font-mono font-semibold text-admin-indigo">{priceRange(s.categories)}</span>,
  },
  {
    key: "extras",
    header: "Wheelchair / blocked",
    cell: (s) => `${s.accessibleSeats} / ${s.blockedSeats}`,
  },
  {
    key: "shows",
    header: "Upcoming shows",
    cell: (s) => <StatusBadge tone={s.upcomingShows > 0 ? "success" : "neutral"}>{s.upcomingShows}</StatusBadge>,
  },
];

/**
 * Prototype seat-management.html: the vendor's seat layouts (one per screen) and the live seat manager for a show.
 * Both read only the session vendor's venues and shows.
 */
export default async function SeatLayoutsPage({ searchParams }: PageProps<"/seat-layouts">) {
  const { vendor } = await requireVendorPage("/seat-layouts");
  const sp = await searchParams;
  const tab = param(sp, "tab") === "live" ? "live" : "layouts";

  return (
    <>
      <PageHeader
        title="Seat Layouts & Live Seats"
        crumb="Seat Layouts"
        subtitle="Your auditorium layouts, and each show's live seats: block seats or release a stuck hold."
      />
      <nav className="flex items-center gap-2 border-b border-admin-border" aria-label="Seat layout views">
        <TabLink href="/seat-layouts" active={tab === "layouts"} icon={LayoutGrid} label="Seat layouts" />
        <TabLink href="/seat-layouts?tab=live" active={tab === "live"} icon={ShieldAlert} label="Live seat manager" />
      </nav>
      {tab === "layouts" ? <LayoutsTab vendorId={vendor.id} sp={sp} /> : <LiveTab vendorId={vendor.id} sp={sp} />}
    </>
  );
}

async function LayoutsTab({ vendorId, sp }: { vendorId: string; sp: SearchParamsRecord }) {
  const params = parseListParams(sp, { sortable: [], defaultSort: { field: "venue", direction: "asc" } });
  const venueId = param(sp, "venue") || undefined;
  const result = await load(() =>
    Promise.all([listVendorLayouts(vendorId, new Date(), venueId), listVendorVenueOptions(vendorId)]),
  );
  if (!result.ok) return <TableError />;
  const [rows, venues] = result.data;
  const page = rows.slice((params.page - 1) * params.limit, params.page * params.limit);
  return (
    <>
      <FilterBar
        searchParam={null}
        filters={[{ name: "venue", label: "Venue", options: venues, allLabel: "All venues" }]}
      />
      <DataTable
        columns={COLUMNS}
        rows={page}
        rowKey={(s) => `${s.venueId}:${s.id}`}
        total={rows.length}
        params={params}
        pathname="/seat-layouts"
        searchParams={sp}
        caption="Seat layouts"
        rowActions={(s) => (
          <Link
            href={`/venues/${s.venueId}/screens/${s.id}/layout`}
            className="inline-flex items-center gap-1 rounded-md border border-admin-border px-2.5 py-1.5 text-[11px] font-bold text-admin-indigo hover:bg-admin-active"
          >
            <Grid3x3 className="h-3.5 w-3.5" aria-hidden /> Edit grid
          </Link>
        )}
        empty={
          <EmptyState
            title="No screens yet"
            description="Add a venue and its screens first; each screen has one seat layout."
            action={
              <Link href="/venues" className="text-xs font-bold text-admin-indigo hover:underline">
                Go to Venues & Screens
              </Link>
            }
          />
        }
      />
    </>
  );
}

async function LiveTab({ vendorId, sp }: { vendorId: string; sp: SearchParamsRecord }) {
  const now = new Date();
  const rawDate = param(sp, "date") ?? "";
  const dateKey = isDateKey(rawDate) ? rawDate : istDateKey(now);
  const venueId = param(sp, "venue") ?? "";
  const showId = param(sp, "show") ?? "";

  const result = await load(() =>
    Promise.all([
      listVendorVenueOptions(vendorId),
      listVendorShowOptions(vendorId, { dateKey, ...(venueId ? { venueId } : {}) }),
      showId ? getShowSeatBoard(vendorId, showId, now) : null,
    ]),
  );
  if (!result.ok) return <TableError message="The live seat map couldn't be loaded. Please try again." />;
  const [venues, shows, board] = result.data;
  return (
    <>
      <ShowPicker venues={venues} shows={shows} venueId={venueId} dateKey={dateKey} showId={showId} />
      {board ? (
        <ShowSeatBoard board={board} />
      ) : (
        <Card>
          <EmptyState
            title={showId ? "Show not found" : "Pick a show"}
            description={
              showId
                ? "This show doesn't exist, isn't yours, or sells passes instead of seats."
                : "Choose a venue, date and show to see its seats live."
            }
          />
        </Card>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors",
        active ? "border-admin-indigo text-admin-indigo" : "border-transparent text-admin-muted hover:text-admin-dark",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </Link>
  );
}
