import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getOnboardingState, listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { describeCutoff } from "@showbuzz/schemas/vendor";
import { formatINR } from "@showbuzz/utils/money";
import { BusinessProfileEditor } from "@/components/profile/BusinessProfileEditor";

export const metadata: Metadata = { title: "Business Profile" };

const pct = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.00$/, "")}%`;

/**
 * The vendor's business details, KYC and payout bank account (editable, same rules as onboarding), plus the terms
 * ShowBuzz sets for it (read-only here; the super-admin changes them).
 */
export default async function BusinessProfilePage() {
  const { vendor: current } = await requireVendorPage("/business-profile");
  const state = await getOnboardingState(current.id);
  const cities = await listCityOptions(state.vendor.address.cityId);
  const { vendor, kyc } = state;

  return (
    <>
      <PageHeader
        title="Business Profile"
        crumb="Business Profile"
        subtitle="Your business details, KYC and payout bank account."
      />
      <Card className="grid grid-cols-1 gap-4 p-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Term label="Account">
          <StatusBadge tone={vendor.status === "active" ? "success" : "danger"}>
            {vendor.status === "active" ? "Active" : "Suspended"}
          </StatusBadge>
        </Term>
        <Term label="Billing">
          {vendor.billingModel === "commission"
            ? `Commission ${pct(vendor.commissionBps)} of net sales`
            : "Monthly subscription"}
        </Term>
        <Term label="Customer fees">
          Convenience fee {pct(vendor.convenienceFeeBps)} + GST {pct(vendor.gstBps)} on it
        </Term>
        <Term label="Customer contact on bookings">{vendor.shareCustomerContact ? "Shared" : "Hidden"}</Term>
        <Term label="Cancellation">
          {vendor.cancellation.allowed
            ? `${describeCutoff(vendor.cancellation.cutoffMinutes)}, fee ${formatINR(vendor.cancellation.feePaise)}`
            : "Not allowed"}
        </Term>
        <p className="text-[11px] text-admin-muted sm:col-span-2 lg:col-span-3">
          Billing, fees and contact sharing are set by ShowBuzz. Contact your account manager to change them.
        </p>
      </Card>
      <BusinessProfileEditor vendor={vendor} kyc={kyc} cities={cities} missingDocuments={state.missingDocuments} />
    </>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</p>
      <div className="mt-0.5 font-semibold text-admin-dark">{children}</div>
    </div>
  );
}
