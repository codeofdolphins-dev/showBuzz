import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Star } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listCitiesAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { CITY_TIERS } from "@showbuzz/schemas/master-data";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminCityRow } from "@showbuzz/schemas/types/admin-platform";
import { moveCityAction } from "@/app/_actions/master-data";
import { MoveButtons } from "@/components/common/MoveButtons";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Cities & Regions" };

const tierLabel = (tier: string) => CITY_TIERS.find((t) => t.value === tier)?.label ?? tier;

const COLUMNS: DataTableColumn<AdminCityRow>[] = [
  {
    key: "city",
    header: "Metropolitan city",
    cell: (c) => (
      <span>
        <span className="flex items-center gap-1 font-bold text-admin-dark">
          {c.name}
          {c.popular ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-label="Popular" /> : null}
        </span>
        <span className="block font-mono text-[10px] text-admin-subtle">{c.slug}</span>
      </span>
    ),
  },
  { key: "state", header: "State / region", cell: (c) => c.state || "—" },
  { key: "tier", header: "Classification", cell: (c) => <StatusBadge tone="indigo">{tierLabel(c.tier)}</StatusBadge> },
  { key: "cinemas", header: "Cinemas", className: "text-right", cell: (c) => c.cinemas },
  { key: "shows", header: "Shows today", className: "text-right", cell: (c) => c.todayShows },
  { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
];

/** Prototype cities.html: the cities of the public city picker, in picker order. */
export default async function CitiesPage({ searchParams }: PageProps<"/cities">) {
  const { staff } = await requireStaffPage("/cities");
  if (!hasPermission(staff.permissions, "cities:read")) return <NoAccess title="Cities & Regions" />;
  const sp = await searchParams;
  const result = await load(() => listCitiesAdmin(new Date()));
  const canWrite = hasPermission(staff.permissions, "cities:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Metropolitan Cities & Operating Hubs"
        crumb="Cities & Regions"
        subtitle="The public city picker lists active cities in this order. Cities are switched off, never deleted."
        actions={
          canWrite ? (
            <LinkButton href="/cities/new">
              <Plus className="h-4 w-4" aria-hidden /> Add city
            </LinkButton>
          ) : null
        }
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(c) => c.id}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "sortOrder", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/cities"
          searchParams={sp}
          caption="Cities"
          rowActions={
            canWrite
              ? (c) => (
                  <>
                    <MoveButtons
                      id={c.id}
                      label={c.name}
                      first={rows[0]?.id === c.id}
                      last={rows.at(-1)?.id === c.id}
                      action={moveCityAction}
                    />
                    <Link
                      href={`/cities/${c.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </>
                )
              : undefined
          }
          empty={<EmptyState title="No cities yet" description="Run pnpm db:seed or add the first city." />}
        />
      )}
    </>
  );
}
