import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import {
  FOOD_SORT_FIELDS,
  listVendorCinemaOptions,
  listVendorFood,
} from "@showbuzz/core/services/partner/food.service";
import { foodCategorySchema } from "@showbuzz/schemas/food";
import type { VendorFoodRow } from "@showbuzz/schemas/types/partner-box-office";
import { formatINR } from "@showbuzz/utils/money";
import { FoodAvailabilityToggle } from "@/components/food/FoodAvailabilityToggle";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Food & Beverages" };

const CATEGORY_OPTIONS = foodCategorySchema.options.map((c) => ({ value: c, label: c }));
const AVAILABILITY_OPTIONS = [
  { value: "yes", label: "Available" },
  { value: "no", label: "Off the menu" },
];

const COLUMNS: DataTableColumn<VendorFoodRow>[] = [
  {
    key: "name",
    header: "Item",
    sortField: "name",
    cell: (f) => (
      <span className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- vendor-supplied URLs (no remotePatterns) */}
        <img src={f.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-admin-border object-cover" />
        <span>
          <span className="flex items-center gap-1.5 font-bold text-admin-dark">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm border ${f.isVeg ? "border-emerald-600 bg-emerald-500" : "border-red-700 bg-red-600"}`}
              aria-label={f.isVeg ? "Veg" : "Non-veg"}
              role="img"
            />
            {f.name}
          </span>
          <span className="block text-[11px] text-admin-subtle">
            {[f.category, f.size].filter(Boolean).join(" · ")}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "price",
    header: "Price",
    sortField: "pricePaise",
    cell: (f) => <span className="font-mono font-bold">{formatINR(f.pricePaise)}</span>,
  },
  { key: "venues", header: "Cinemas", cell: (f) => <span className="text-[11px]">{f.venuesLabel}</span> },
  {
    key: "available",
    header: "Available",
    cell: (f) => <FoodAvailabilityToggle id={f.id} name={f.name} available={f.available} />,
  },
];

/** The vendor's food & beverage menu, offered with movie shows at its cinemas on showbuzz.com. */
export default async function FoodPage({ searchParams }: PageProps<"/food">) {
  const { vendor } = await requireVendorPage("/food");
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: FOOD_SORT_FIELDS,
    defaultSort: { field: "sortOrder", direction: "asc" },
  });
  const category = foodCategorySchema.safeParse(param(sp, "category"));
  const availableParam = param(sp, "available");
  const venueId = param(sp, "venue") || undefined;
  const [result, cinemas] = await Promise.all([
    load(() =>
      listVendorFood(vendor.id, {
        ...params,
        ...(category.success ? { category: category.data } : {}),
        ...(availableParam === "yes" ? { available: true } : availableParam === "no" ? { available: false } : {}),
        ...(venueId ? { venueId } : {}),
      }),
    ),
    listVendorCinemaOptions(vendor.id).catch(() => []),
  ]);
  const filtered = Boolean(params.q || category.success || availableParam || venueId);

  return (
    <>
      <PageHeader
        title="Food & Beverages"
        crumb="Food & Beverages"
        subtitle="Snacks and combos customers can pre-order with movie tickets at your cinemas."
        actions={
          <LinkButton href="/food/new">
            <Plus className="h-4 w-4" aria-hidden /> Add item
          </LinkButton>
        }
      />
      <FilterBar
        searchPlaceholder="Search the menu…"
        filters={[
          { name: "category", label: "Category", options: CATEGORY_OPTIONS },
          { name: "available", label: "Availability", options: AVAILABILITY_OPTIONS },
          { name: "venue", label: "Cinema", options: cinemas, allLabel: "All cinemas" },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(f) => f.id}
          total={result.data.total}
          params={params}
          pathname="/food"
          searchParams={sp}
          caption="Food menu"
          rowActions={(f) => (
            <Link
              href={`/food/${f.id}/edit`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Edit ${f.name}`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={
            <EmptyState
              title={filtered ? "No items match" : "Your menu is empty"}
              description={
                cinemas.length === 0
                  ? "Food is offered at cinemas: add a cinema under Venues first."
                  : filtered
                    ? "Try another filter."
                    : "Add popcorn, drinks and combos customers can order with their tickets."
              }
            />
          }
        />
      )}
    </>
  );
}
