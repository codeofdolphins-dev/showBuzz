import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { VENDOR_SORT_FIELDS, listVendorsAdmin } from "@showbuzz/core/services/admin/vendor-admin.service";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminVendorRow } from "@showbuzz/schemas/types/admin-marketplace";
import {
  VENDOR_BUSINESS_TYPE_LABELS,
  billingModelSchema,
  vendorOnboardingStatusSchema,
  vendorStatusSchema,
} from "@showbuzz/schemas/vendor";
import { formatINR } from "@showbuzz/utils/money";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Vendors" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];
const BILLING_OPTIONS = [
  { value: "commission", label: "Commission" },
  { value: "subscription", label: "Subscription" },
];
const ONBOARDING_OPTIONS = [
  { value: "complete", label: "Onboarded" },
  { value: "incomplete", label: "Onboarding" },
];

const COLUMNS: DataTableColumn<AdminVendorRow>[] = [
  {
    key: "business",
    header: "Vendor / Company",
    sortField: "businessName",
    cell: (v) => (
      <span>
        <Link href={`/vendors/${v.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
          {v.businessName}
        </Link>
        <span className="block text-[11px] text-admin-subtle">
          {VENDOR_BUSINESS_TYPE_LABELS[v.businessType]} · {v.cityName}
        </span>
      </span>
    ),
  },
  {
    key: "contact",
    header: "Contact person",
    cell: (v) => (
      <span>
        <span className="block font-semibold">{v.contactName}</span>
        <span className="block text-[11px] text-admin-subtle">{v.contactPhone}</span>
      </span>
    ),
  },
  {
    key: "listings",
    header: "Listings",
    cell: (v) => (
      <span className="text-[11px]">
        {v.venues} venue{v.venues === 1 ? "" : "s"} · {v.events} event{v.events === 1 ? "" : "s"}
      </span>
    ),
  },
  {
    key: "gross",
    header: "Gross sales",
    className: "text-right",
    cell: (v) => <span className="font-mono font-bold">{formatINR(v.grossSalesPaise)}</span>,
  },
  { key: "billing", header: "Billing", cell: (v) => <span className="text-[11px]">{v.billingLabel}</span> },
  {
    key: "status",
    header: "Status",
    cell: (v) => (
      <span className="flex flex-wrap gap-1">
        <StatusBadge status={v.status} />
        {v.onboardingStatus === "incomplete" ? <StatusBadge tone="warning">Onboarding</StatusBadge> : null}
      </span>
    ),
  },
];

/** Every vendor on the marketplace (prototype organisers.html): cinema chains, organisers and venue operators. */
export default async function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  const { staff } = await requireStaffPage("/vendors");
  if (!hasPermission(staff.permissions, "organisers:read")) return <NoAccess title="Vendors" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: VENDOR_SORT_FIELDS,
    defaultSort: { field: "businessName", direction: "asc" },
  });
  const status = vendorStatusSchema.safeParse(param(sp, "status"));
  const billing = billingModelSchema.safeParse(param(sp, "billing"));
  const onboarding = vendorOnboardingStatusSchema.safeParse(param(sp, "onboarding"));
  const cityId = param(sp, "city") || undefined;
  const [result, cities] = await Promise.all([
    load(() =>
      listVendorsAdmin({
        ...params,
        ...(status.success ? { status: status.data } : {}),
        ...(billing.success ? { billingModel: billing.data } : {}),
        ...(onboarding.success ? { onboardingStatus: onboarding.data } : {}),
        ...(cityId ? { cityId } : {}),
      }),
    ),
    listCityOptions().catch(() => []),
  ]);
  const canWrite = hasPermission(staff.permissions, "organisers:write");

  return (
    <>
      <PageHeader
        title="Vendors"
        crumb="Vendors"
        subtitle="Cinema chains, event organisers and venue operators selling on ShowBuzz: KYC, billing terms and status."
        actions={
          canWrite ? (
            <LinkButton href="/vendors/new">
              <Plus className="h-4 w-4" aria-hidden /> Create vendor
            </LinkButton>
          ) : null
        }
      />
      <FilterBar
        searchPlaceholder="Search name, email or GSTIN…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "billing", label: "Billing", options: BILLING_OPTIONS },
          { name: "onboarding", label: "KYC", options: ONBOARDING_OPTIONS },
          { name: "city", label: "City", options: cities, allLabel: "All cities" },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(v) => v.id}
          total={result.data.total}
          params={params}
          pathname="/vendors"
          searchParams={sp}
          caption="Vendors"
          rowActions={(v) => (
            <Link
              href={`/vendors/${v.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${v.businessName}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No vendors match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
