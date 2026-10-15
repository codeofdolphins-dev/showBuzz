import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams, type SearchParamsRecord } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { LISTING_SORT_FIELDS, listListingsAdmin } from "@showbuzz/core/services/admin/listing-admin.service";
import { cityNames, listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import {
  LISTING_SECTIONS,
  listingAdminStatusSchema,
  listingWhenSchema,
  type ListingKind,
} from "@showbuzz/schemas/admin-catalog";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminListingRow } from "@showbuzz/schemas/types/admin-catalog";
import { load } from "@/lib/load";

const STATUS_OPTIONS = [
  { value: "active", label: "Live" },
  { value: "inactive", label: "Switched off by vendor" },
  { value: "taken_down", label: "Taken down" },
];
const WHEN_OPTIONS = [
  { value: "upcoming", label: "Upcoming / daily" },
  { value: "past", label: "Past" },
];

export function listingStatusBadge(row: Pick<AdminListingRow, "takenDown" | "status" | "past">) {
  if (row.takenDown) return <StatusBadge tone="danger">Taken down</StatusBadge>;
  if (row.status === "inactive") return <StatusBadge tone="neutral">Off (vendor)</StatusBadge>;
  if (row.past) return <StatusBadge tone="neutral">Ended</StatusBadge>;
  return <StatusBadge tone="success">Live</StatusBadge>;
}

/**
 * Prototype events.html / plays.html / sports.html / activities.html, across every vendor: title and category,
 * vendor, venue and city, date, tickets sold of capacity and status. Vendors edit their listings in the partner
 * portal; staff open one to see its tiers and bookings, and take it down if needed.
 */
export async function ListingsList({ kind, sp }: { kind: ListingKind; sp: SearchParamsRecord }) {
  const section = LISTING_SECTIONS[kind];
  const { staff } = await requireStaffPage(section.path);
  if (!hasPermission(staff.permissions, `${section.resource}:read`)) return <NoAccess title={section.many} />;
  const params = parseListParams(sp, {
    sortable: LISTING_SORT_FIELDS,
    defaultSort: { field: "startsAt", direction: "desc" },
  });
  const status = listingAdminStatusSchema.safeParse(param(sp, "status")).data;
  const when = listingWhenSchema.safeParse(param(sp, "when")).data;
  const vendorId = param(sp, "vendor");
  const cityId = param(sp, "city");
  const now = new Date();
  const [result, options] = await Promise.all([
    load(() =>
      listListingsAdmin(
        kind,
        {
          ...params,
          ...(status ? { status } : {}),
          ...(when ? { when } : {}),
          ...(vendorId ? { vendorId } : {}),
          ...(cityId ? { cityId } : {}),
        },
        now,
      ),
    ),
    connect()
      .then(async () => ({ vendors: await listVendorOptions(), cities: await cityNames() }))
      .catch(() => ({ vendors: [], cities: new Map<string, string>() })),
  ]);

  const columns: DataTableColumn<AdminListingRow>[] = [
    {
      key: "title",
      header: `${section.one} & category`,
      sortField: "title",
      cell: (r) => (
        <span className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- vendor-supplied catalogue images */}
          <img src={r.poster} alt="" className="h-12 w-9 shrink-0 rounded border border-admin-border object-cover" />
          <span>
            <Link href={`${section.path}/${r.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
              {r.title}
            </Link>
            <span className="block text-[11px] text-admin-subtle">{r.category}</span>
          </span>
        </span>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      cell: (r) => (
        <Link href={`/vendors/${r.vendorId}`} className="text-admin-text hover:text-admin-indigo">
          {r.vendorName}
        </Link>
      ),
    },
    {
      key: "venue",
      header: "Venue & city",
      cell: (r) => (
        <span>
          {r.venueName}
          <span className="block text-[11px] text-admin-subtle">{r.cityName}</span>
        </span>
      ),
    },
    { key: "when", header: "Date & time", sortField: "startsAt", cell: (r) => r.when },
    {
      key: "sold",
      header: "Sold / capacity",
      cell: (r) => (
        <span className="font-mono">
          {r.sold.toLocaleString("en-IN")} / {r.capacity.toLocaleString("en-IN")}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: listingStatusBadge },
  ];

  return (
    <>
      <PageHeader
        title={section.many}
        crumb={section.many}
        subtitle={`Every vendor's ${section.many.toLowerCase()} on ShowBuzz. Vendors manage their own listings in the partner portal; open one to review it or take it down.`}
      />
      <FilterBar
        searchPlaceholder="Search title, category or venue…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "when", label: "When", options: WHEN_OPTIONS, allLabel: "Any time" },
          { name: "vendor", label: "Vendor", options: options.vendors, allLabel: "All vendors" },
          {
            name: "city",
            label: "City",
            options: [...options.cities.entries()]
              .map(([value, label]) => ({ value, label }))
              .sort((a, b) => a.label.localeCompare(b.label)),
            allLabel: "All cities",
          },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={columns}
          rows={result.data.rows}
          rowKey={(r) => r.id}
          total={result.data.total}
          params={params}
          pathname={section.path}
          searchParams={sp}
          caption={section.many}
          rowActions={(r) => (
            <Link
              href={`${section.path}/${r.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${r.title}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={
            <EmptyState
              title={`No ${section.many.toLowerCase()} match`}
              description="Try another search or filter. Vendors add listings from the partner portal."
            />
          }
        />
      )}
    </>
  );
}
