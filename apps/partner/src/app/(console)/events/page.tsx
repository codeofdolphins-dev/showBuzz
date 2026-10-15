import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { EVENT_SORT_FIELDS, listVendorEvents } from "@showbuzz/core/services/partner/listing.service";
import { listVendorVenueOptions } from "@showbuzz/core/services/partner/venue.service";
import { eventKindSchema } from "@showbuzz/schemas/event";
import { EVENT_KIND_LABELS, listingStatusSchema } from "@showbuzz/schemas/partner-listing";
import type { VendorEventRow } from "@showbuzz/schemas/types/partner-listing";
import { formatINR } from "@showbuzz/utils/money";
import { cn } from "@showbuzz/utils/cn";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Events" };

const KINDS = eventKindSchema.options;
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const iconLink = "rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo";

function columns(kind: string): DataTableColumn<VendorEventRow>[] {
  return [
    {
      key: "title",
      header: "Listing",
      sortField: "title",
      cell: (e) => (
        <Link href={`/events/${e.id}/edit`} className="flex items-center gap-3 hover:text-admin-indigo">
          {/* eslint-disable-next-line @next/next/no-img-element -- listing posters are arbitrary remote URLs */}
          <img src={e.poster} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
          <span>
            <span className="block font-bold text-admin-dark">{e.title}</span>
            <span className="block text-[11px] text-admin-subtle">{e.category}</span>
          </span>
        </Link>
      ),
    },
    { key: "venue", header: "Venue", cell: (e) => e.venueName },
    { key: "when", header: "When (IST)", sortField: "schedule.startsAt", cell: (e) => e.when },
    { key: "price", header: "From", cell: (e) => formatINR(e.fromPaise) },
    {
      key: "sales",
      header: kind === "sport" ? "Seats sold" : "Passes sold",
      cell: (e) => `${e.sold.toLocaleString("en-IN")} / ${e.capacity.toLocaleString("en-IN")}`,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) =>
        e.takenDown ? <StatusBadge tone="danger">Taken down</StatusBadge> : <StatusBadge status={e.status} />,
    },
  ];
}

/**
 * Prototype events / plays / sports / activities pages in one list with a tab per kind. Each listing is the vendor's
 * own; sales come from its pass inventory (or, for sports, the fixture's sold seats).
 */
export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const { vendor } = await requireVendorPage("/events");
  const sp = await searchParams;
  const kind = eventKindSchema.catch("event").parse(param(sp, "kind"));
  const params = parseListParams(sp, {
    sortable: EVENT_SORT_FIELDS,
    defaultSort: { field: "title", direction: "asc" },
  });
  const status = listingStatusSchema.safeParse(param(sp, "status")).data;
  const venueId = param(sp, "venue") || undefined;
  const labels = EVENT_KIND_LABELS[kind];

  const [result, venues] = await Promise.all([
    load(() =>
      listVendorEvents(vendor.id, { ...params, kind, ...(status ? { status } : {}), ...(venueId ? { venueId } : {}) }),
    ),
    listVendorVenueOptions(vendor.id).catch(() => []),
  ]);
  const filtered = Boolean(params.q || status || venueId);

  return (
    <>
      <PageHeader
        title="Events"
        crumb="Events"
        subtitle="Your events, plays, sports fixtures and activities, their ticket tiers and sales."
        actions={
          <LinkButton href={`/events/new?kind=${kind}`}>
            <Plus className="h-4 w-4" aria-hidden /> Add {labels.one.toLowerCase()}
          </LinkButton>
        }
      />
      <nav aria-label="Listing type" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={`/events?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-bold",
              k === kind
                ? "border-admin-indigo bg-admin-indigo text-white"
                : "border-admin-border bg-white text-admin-muted hover:text-admin-indigo",
            )}
          >
            {EVENT_KIND_LABELS[k].many}
          </Link>
        ))}
      </nav>
      <FilterBar
        searchPlaceholder={`Search ${labels.many.toLowerCase()}…`}
        filters={[
          { name: "venue", label: "Venue", options: venues },
          { name: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={columns(kind)}
          rows={result.data.rows}
          rowKey={(e) => e.id}
          total={result.data.total}
          params={params}
          pathname="/events"
          searchParams={sp}
          caption={`Your ${labels.many.toLowerCase()}`}
          rowActions={(e) => (
            <>
              <Link href={`/events/${e.id}/edit`} className={iconLink} aria-label={`Edit ${e.title}`}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Link>
              {kind === "sport" ? (
                <Link href={`/shows?event=${e.id}`} className={iconLink} aria-label={`Show of ${e.title}`}>
                  <CalendarClock className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </>
          )}
          empty={
            <EmptyState
              title={filtered ? `No ${labels.many.toLowerCase()} match` : `No ${labels.many.toLowerCase()} yet`}
              description={
                filtered ? "Try other filters." : `Add your first ${labels.one.toLowerCase()} to sell tickets.`
              }
            />
          }
        />
      )}
    </>
  );
}
