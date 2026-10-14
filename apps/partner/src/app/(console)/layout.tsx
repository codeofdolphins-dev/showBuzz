import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { ConsoleShell } from "@showbuzz/console-ui/ConsoleShell";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { PARTNER_NAV, PARTNER_TAB_IDS } from "@/lib/nav";

const BRANDING = { name: "ShowBuzz", tagline: "Partner Portal", footer: "ShowBuzz Partner · Vendor portal" };

/**
 * Authenticated portal chrome. Vendors who haven't finished onboarding are sent to /onboarding (requireVendorPage);
 * a suspended vendor sees every page with a notice, and listing changes are refused on the server.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { vendorUser, vendor } = await requireVendorPage("/dashboard");
  return (
    <ConsoleShell
      branding={BRANDING}
      user={{ name: vendorUser.name, subtitle: vendor.businessName, email: vendorUser.email }}
      nav={PARTNER_NAV}
      logoutPath="/api/v1/partner/auth/logout"
      loginPath="/login"
      tabIds={PARTNER_TAB_IDS}
      banner={vendor.status === "suspended" ? <SuspendedNotice /> : null}
    >
      {children}
    </ConsoleShell>
  );
}

function SuspendedNotice() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-admin-danger" aria-hidden />
      <div className="text-xs">
        <p className="font-bold text-admin-danger">Your partner account is suspended</p>
        <p className="text-red-800">
          Your listings are hidden from ShowBuzz and can&apos;t be changed. You can still view your bookings and
          earnings. Contact your ShowBuzz account manager to reactivate the account.
        </p>
      </div>
    </div>
  );
}
