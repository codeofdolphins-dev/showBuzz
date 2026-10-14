import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { VENUE_SORT_FIELDS, listVendorVenues } from "@showbuzz/core/services/partner/venue.service";
import { VENUE_KIND_LABELS } from "@showbuzz/schemas/partner-venue";
import type { VendorVenueRow } from "@showbuzz/schemas/types/partner-venue";
import { venueKindSchema, venueStatusSchema } from "@showbuzz/schemas/venue";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Venues & Screens" };

const KIND_OPTIONS = Object.entries(VENUE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const COLUMNS: DataTableColumn<VendorVenueRow>[] = [
  {
    key: "name",
    header: "Venue",
    sortField: "name",
    cell: (v) => (
      <Link href={`/venues/${v.id}`} className="block hover:text-admin-indigo">
        <span className="font-bold text-admin-dark">{v.name}</span>
        <span className="block font-mono text-[11px] text-admin-subtle">/{v.slug}</span>
      </Link>
    ),
  },
  {
    key: "kind",
    header: "Type",
    sortField: "kind",
    cell: (v) => <StatusBadge tone={v.kind === "cinema" ? "indigo" : "info"}>{VENUE_KIND_LABELS[v.kind]}</StatusBadge>,
  },
  {
    key: "city",
    header: "City & address",
    sortField: "cityId",
    cell: (v) => (
      <>
        <span className="font-semibold">{v.cityName}</span>
        <span className="line-clamp-1 block max-w-xs text-[11px] text-admin-subtle">{v.address}</span>
      </>
    ),
  },
  { key: "screens", header: "Screens", cell: (v) => v.screens },
  { key: "capacity", header: "Capacity", cell: (v) => `${v.capacity.toLocaleString("en-IN")} seats` },
  { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} /> },
];

/** Prototype cinemas.html + venues.html in one list: the vendor's cinemas, stadiums and event venues. */
export default async function VenuesPage({ searchParams }: PageProps<"/venues">) {
  const { vendor } = await requireVendorPage("/venues");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: VENUE_SORT_FIELDS, defaultSort: { field: "name", direction: "asc" } });
  const kind = venueKindSchema.safeParse(param(sp, "kind")).data;
  const status = venueStatusSchema.safeParse(param(sp, "status")).data;
  const cityId = param(sp, "city") || undefined;

  const cities = await listCityOptions();
  const result = await load(() =>
    listVendorVenues(vendor.id, {
      ...params,
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(cityId ? { cityId } : {}),
    }),
  );
  const content = !result.ok ? (
    <TableError />
  ) : (
    <DataTable
      columns={COLUMNS}
      rows={result.data.rows}
      rowKey={(v) => v.id}
      total={result.data.total}
      params={params}
      pathname="/venues"
      searchParams={sp}
      caption="Your venues"
      rowActions={(v) => (
        <>
          <Link
            href={`/venues/${v.id}`}
            className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
            aria-label={`Open ${v.name}`}
          >
            <Eye className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={`/venues/${v.id}/edit`}
            className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
            aria-label={`Edit ${v.name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
        </>
      )}
      empty={
        <EmptyState
          title={params.q || kind || status || cityId ? "No venues match" : "No venues yet"}
          description={
            params.q || kind || status || cityId
              ? "Try other filters."
              : "Add your cinema, stadium or event venue to start selling shows on ShowBuzz."
          }
        />
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Venues & Screens"
        crumb="Venues"
        subtitle="Your cinemas, stadiums and event venues, their screens and seat layouts."
        actions={
          <LinkButton href="/venues/new">
            <Plus className="h-4 w-4" aria-hidden /> Add venue
          </LinkButton>
        }
      />
      <FilterBar
        searchPlaceholder="Search name or address…"
        filters={[
          { name: "kind", label: "Type", options: KIND_OPTIONS },
          { name: "city", label: "City", options: cities },
          { name: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
      />
      {content}
    </>
  );
}
