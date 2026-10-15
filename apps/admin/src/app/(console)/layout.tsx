import type { ReactNode } from "react";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ConsoleShell } from "@showbuzz/console-ui/ConsoleShell";
import { navFor } from "@/lib/nav";

const BRANDING = { name: "ShowBuzz", tagline: "Admin Console", footer: "ShowBuzz Admin · Staff-only console" };

/** Prototype bottom tabs: Dashboard, Movies, Bookings, Shows (those the role can open) + Menu. */
const TAB_IDS = ["movies", "bookings", "shows"];

/**
 * Authenticated console chrome. The menu is filtered here, on the server, from the staff member's role; pages
 * still check their own permission (hiding a link is not access control).
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { staff } = await requireStaffPage("/dashboard");
  return (
    <ConsoleShell
      branding={BRANDING}
      user={{ name: staff.name, subtitle: staff.role.name, email: staff.email }}
      nav={navFor(staff.permissions)}
      logoutPath="/api/v1/admin/auth/logout"
      loginPath="/login"
      tabIds={TAB_IDS}
      notificationsHref="/notifications"
      notificationsCountUrl="/api/v1/admin/notifications/unread"
    >
      {children}
    </ConsoleShell>
  );
}
