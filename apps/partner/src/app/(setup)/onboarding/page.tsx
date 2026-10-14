import type { Metadata } from "next";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getOnboardingState, listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = { title: "Onboarding" };

/**
 * Mandatory KYC before anything else (business details → GSTIN/PAN → bank account → documents → review). Vendors
 * who finished are sent to the dashboard; a super-admin-created vendor lands here on first sign-in too.
 */
export default async function OnboardingPage() {
  const { vendor } = await requireVendorPage("/onboarding", { stage: "onboarding" });
  const [state, cities] = await Promise.all([getOnboardingState(vendor.id), listCityOptions()]);

  return (
    <>
      <div>
        <h1 className="text-xl font-black tracking-tight text-admin-dark lg:text-2xl">Complete your partner profile</h1>
        <p className="mt-0.5 text-xs text-admin-muted">
          We need a few business and KYC details before your listings can go live on ShowBuzz. Your progress is saved
          after each step.
        </p>
      </div>
      {vendor.status === "suspended" ? (
        <p
          role="status"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-admin-danger"
        >
          This account is suspended. You can finish onboarding, but listings stay offline until ShowBuzz reactivates it.
        </p>
      ) : null}
      <OnboardingWizard state={state} cities={cities} />
    </>
  );
}
