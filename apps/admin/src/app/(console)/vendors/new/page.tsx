import type { Metadata } from "next";
import Link from "next/link";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { vendorPrefillFromRequest } from "@showbuzz/core/services/admin/show-request.service";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CreateVendorForm } from "@/components/vendors/CreateVendorForm";

export const metadata: Metadata = { title: "Create vendor" };

/**
 * Creates a vendor on its behalf (same details as the partner signup, without the mobile code). `?lead=<id>`
 * pre-fills it from a list-your-show request and links the request to the new vendor.
 */
export default async function NewVendorPage({ searchParams }: PageProps<"/vendors/new">) {
  const { staff } = await requireStaffPage("/vendors/new");
  if (!hasPermission(staff.permissions, "organisers:write")) return <NoAccess title="Create vendor" />;
  const leadId = param(await searchParams, "lead");
  const [cities, prefill] = await Promise.all([
    listCityOptions(),
    leadId && hasPermission(staff.permissions, "list-your-show:read") ? vendorPrefillFromRequest(leadId) : null,
  ]);
  // The request names a city as free text; pick it when it matches one of ours.
  const cityId = prefill
    ? cities.find((c) => c.label.toLowerCase().startsWith(prefill.city.toLowerCase()))?.value
    : undefined;

  return (
    <>
      <PageHeader
        title="Create vendor"
        crumb="Vendors"
        subtitle="Sets up the business and its partner login. KYC onboarding follows, by you or by the vendor."
      />
      {prefill ? (
        <p className="rounded-lg border border-admin-border bg-admin-active px-4 py-3 text-xs text-admin-indigo">
          Pre-filled from list-your-show request{" "}
          <Link href={`/list-your-show/${prefill.leadId}`} className="font-bold underline">
            {prefill.reference}
          </Link>
          . Check the details before creating.
        </p>
      ) : null}
      <Card className="max-w-3xl p-6">
        <CreateVendorForm
          cities={cities}
          defaults={
            prefill
              ? {
                  leadId: prefill.leadId,
                  businessName: prefill.businessName,
                  businessType: prefill.businessType,
                  contactName: prefill.contactName,
                  email: prefill.email,
                  phone: prefill.phone,
                  ...(cityId ? { cityId } : {}),
                }
              : undefined
          }
        />
      </Card>
    </>
  );
}
