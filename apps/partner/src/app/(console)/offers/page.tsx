import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge, type StatusTone } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import {
  COUPON_SORT_FIELDS,
  type CouponPhase,
  listVendorCoupons,
} from "@showbuzz/core/services/partner/coupon.service";
import type { VendorCouponRow } from "@showbuzz/schemas/types/partner-box-office";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { CouponStatusButton } from "@/components/offers/CouponStatusButton";
import { LinkButton } from "@/components/venues/LinkButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Offers & Coupons" };

const PHASES: Record<CouponPhase, { label: string; tone: StatusTone }> = {
  live: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  used_up: { label: "Fully redeemed", tone: "warning" },
  expired: { label: "Expired", tone: "neutral" },
  inactive: { label: "Inactive", tone: "danger" },
};
const PHASE_OPTIONS = Object.entries(PHASES).map(([value, { label }]) => ({ value, label }));

function discountLabel(c: VendorCouponRow): string {
  if (c.kind === "percent") {
    const pct = ((c.percentBps ?? 0) / 100).toFixed(2).replace(/\.?0+$/, "");
    return `${pct}% off${c.maxDiscountPaise !== undefined ? ` (max ${formatINR(c.maxDiscountPaise)})` : ""}`;
  }
  return `${formatINR(c.flatPaise ?? 0)} flat off`;
}

const COLUMNS: DataTableColumn<VendorCouponRow>[] = [
  {
    key: "code",
    header: "Code",
    sortField: "code",
    cell: (c) => (
      <Link href={`/offers/${c.id}/edit`} className="hover:text-admin-indigo">
        <span className="block font-mono font-black text-admin-dark">{c.code}</span>
        <span className="block max-w-56 truncate text-[11px] text-admin-subtle">{c.title}</span>
      </Link>
    ),
  },
  {
    key: "discount",
    header: "Discount",
    cell: (c) => (
      <>
        <span className="block font-semibold">{discountLabel(c)}</span>
        <span className="block text-[11px] text-admin-subtle">
          {c.appliesTo === "food" ? "On food" : "On tickets"}
          {c.minOrderPaise > 0 ? ` · min ${formatINR(c.minOrderPaise)}` : ""}
        </span>
      </>
    ),
  },
  { key: "scope", header: "Valid at", cell: (c) => <span className="block max-w-48 text-[11px]">{c.scopeLabel}</span> },
  {
    key: "validUntil",
    header: "Validity",
    sortField: "validUntil",
    cell: (c) => (
      <span className="text-[11px]">
        {c.validFrom ? `${formatDateShort(new Date(c.validFrom))} – ` : "Until "}
        {formatDateShort(new Date(c.validUntil))}
      </span>
    ),
  },
  {
    key: "usedCount",
    header: "Usage",
    sortField: "usedCount",
    cell: (c) => (
      <>
        <span className="block font-mono font-bold">
          {c.usedCount.toLocaleString("en-IN")}
          {c.usageLimit !== undefined ? ` / ${c.usageLimit.toLocaleString("en-IN")}` : ""} redeemed
        </span>
        {c.perCustomerLimit !== undefined ? (
          <span className="block text-[11px] text-admin-subtle">{c.perCustomerLimit} per customer</span>
        ) : null}
      </>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (c) => (
      <>
        <StatusBadge tone={PHASES[c.phase].tone}>{PHASES[c.phase].label}</StatusBadge>
        {c.showOnOffersPage ? (
          <span className="mt-1 block text-[10px] text-admin-subtle">Listed on /offers</span>
        ) : null}
      </>
    ),
  },
];

/** Prototype coupons.html / offers.html: the vendor's own promo codes (valid only on its shows). */
export default async function OffersPage({ searchParams }: PageProps<"/offers">) {
  const { vendor } = await requireVendorPage("/offers");
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: COUPON_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const phaseParam = param(sp, "phase");
  const phase = phaseParam && phaseParam in PHASES ? (phaseParam as CouponPhase) : undefined;
  const result = await load(() => listVendorCoupons(vendor.id, { ...params, ...(phase ? { phase } : {}) }, new Date()));

  return (
    <>
      <PageHeader
        title="Offers & Coupons"
        crumb="Offers & Coupons"
        subtitle="Promo codes for your own shows. Discounts come out of your sales."
        actions={
          <LinkButton href="/offers/new">
            <Plus className="h-4 w-4" aria-hidden /> Create coupon
          </LinkButton>
        }
      />
      <FilterBar
        searchPlaceholder="Search code or title…"
        filters={[{ name: "phase", label: "Status", options: PHASE_OPTIONS, allLabel: "All statuses" }]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(c) => c.id}
          total={result.data.total}
          params={params}
          pathname="/offers"
          searchParams={sp}
          caption="Your coupons"
          rowActions={(c) => (
            <>
              <Link
                href={`/offers/${c.id}/edit`}
                className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                aria-label={`Edit ${c.code}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Link>
              <CouponStatusButton id={c.id} code={c.code} active={c.status === "active"} />
            </>
          )}
          empty={
            <EmptyState
              title={params.q || phase ? "No coupons match" : "No coupons yet"}
              description="Create a code customers can apply at checkout on your shows."
            />
          }
        />
      )}
    </>
  );
}
