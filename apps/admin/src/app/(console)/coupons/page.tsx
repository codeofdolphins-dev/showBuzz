import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ADMIN_COUPON_SORT_FIELDS, listCouponsAdmin } from "@showbuzz/core/services/admin/coupon-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminCouponRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { z } from "zod";
import { setCouponStatusAction } from "@/app/_actions/marketing";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Coupons & Promos" };

const OWNER_OPTIONS = [
  { value: "platform", label: "ShowBuzz (platform)" },
  { value: "vendor", label: "Vendor coupons" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

const COLUMNS: DataTableColumn<AdminCouponRow>[] = [
  {
    key: "code",
    header: "Code",
    sortField: "code",
    cell: (c) => (
      <span>
        <span className="block font-mono font-bold text-admin-dark">{c.code}</span>
        <span className="block max-w-56 truncate text-[11px] text-admin-subtle">{c.title}</span>
      </span>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    cell: (c) =>
      c.vendorName ? <StatusBadge tone="info">{c.vendorName}</StatusBadge> : <StatusBadge tone="indigo">ShowBuzz</StatusBadge>,
  },
  { key: "discount", header: "Discount", cell: (c) => c.discountLabel },
  { key: "min", header: "Min order", className: "text-right", cell: (c) => formatINR(c.minOrderPaise) },
  {
    key: "used",
    header: "Usage count",
    sortField: "usedCount",
    className: "text-right",
    cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}`,
  },
  { key: "until", header: "Valid until", sortField: "validUntil", cell: (c) => formatDateShort(new Date(c.validUntil)) },
  { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
];

/**
 * Prototype coupons.html (with offers.html folded in: coupons are what /offers lists). Platform coupons are edited
 * here; vendor coupons are listed read-only (each vendor manages its own in the partner portal).
 */
export default async function CouponsPage({ searchParams }: PageProps<"/coupons">) {
  const { staff } = await requireStaffPage("/coupons");
  if (!hasPermission(staff.permissions, "coupons:read")) return <NoAccess title="Coupons & Promos" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: ADMIN_COUPON_SORT_FIELDS,
    defaultSort: { field: "code", direction: "asc" },
  });
  const result = await load(() =>
    listCouponsAdmin(
      {
        ...params,
        ...defined({
          owner: enumParam(sp, "owner", z.enum(["platform", "vendor"])),
          status: enumParam(sp, "status", z.enum(["active", "inactive", "expired"])),
        }),
      },
      new Date(),
    ),
  );
  const canWrite = hasPermission(staff.permissions, "coupons:write");

  return (
    <>
      <PageHeader
        title="Promo Codes & Discount Vouchers"
        crumb="Coupons & Promos"
        subtitle="Platform coupons apply on every vendor's shows and are always listed on /offers. Coupons are switched off, never deleted."
        actions={
          canWrite ? (
            <LinkButton href="/coupons/new">
              <Plus className="h-4 w-4" aria-hidden /> Create promo code
            </LinkButton>
          ) : null
        }
      />
      <FilterBar
        searchPlaceholder="Search code or title…"
        filters={[
          { name: "owner", label: "Owner", options: OWNER_OPTIONS },
          { name: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
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
          pathname="/coupons"
          searchParams={sp}
          caption="Coupons"
          rowActions={
            canWrite
              ? (c) =>
                  c.vendorName ? (
                    <span className="text-[10px] text-admin-subtle">Vendor-managed</span>
                  ) : (
                    <>
                      <PromptActionButton
                        label={c.status === "inactive" ? "Switch on" : "Switch off"}
                        title={c.status === "inactive" ? `Switch ${c.code} on?` : `Switch ${c.code} off?`}
                        description={
                          c.status === "inactive"
                            ? "Customers can apply it again (within its dates and limits)."
                            : "Checkout stops accepting it straight away."
                        }
                        confirmLabel={c.status === "inactive" ? "Switch on" : "Switch off"}
                        action={setCouponStatusAction.bind(null, c.id, c.status === "inactive" ? "active" : "inactive")}
                        success="Coupon updated."
                      />
                      <Link
                        href={`/coupons/${c.id}`}
                        className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                        aria-label={`Edit ${c.code}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                    </>
                  )
              : undefined
          }
          empty={<EmptyState title="No coupons match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
