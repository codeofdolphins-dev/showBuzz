import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorPolicy } from "@showbuzz/core/services/partner/policy.service";
import { PolicyForm } from "@/components/policy/PolicyForm";

export const metadata: Metadata = { title: "Cancellation Policy" };

/** The vendor's own cancellation policy (shown on its public pages; frozen on each booking when it is sold). */
export default async function CancellationPolicyPage() {
  const { vendor } = await requireVendorPage("/cancellation-policy");
  const { policy, venuesWithoutCancellation } = await getVendorPolicy(vendor.id);
  return (
    <>
      <PageHeader
        title="Cancellation Policy"
        crumb="Cancellation Policy"
        subtitle="Whether customers can cancel, how late, and the fee you keep."
      />
      <PolicyForm policy={policy} />
      {venuesWithoutCancellation.length > 0 ? (
        <Card className="p-5 text-xs text-admin-muted">
          Cancellation is switched off at{" "}
          <strong className="text-admin-dark">{venuesWithoutCancellation.join(", ")}</strong> (venue setting), so
          tickets there stay non-cancellable whatever this policy says. Change it on the venue under{" "}
          <Link href="/venues" className="font-bold text-admin-indigo hover:underline">
            Venues & Screens
          </Link>
          .
        </Card>
      ) : null}
    </>
  );
}
