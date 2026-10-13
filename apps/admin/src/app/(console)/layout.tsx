import type { ReactNode } from "react";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ConsoleShell } from "@/components/shell/ConsoleShell";
import { navFor } from "@/lib/nav";

/**
 * Authenticated console chrome. The menu is filtered here, on the server, from the staff member's role; pages
 * still check their own permission (hiding a link is not access control).
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { staff } = await requireStaffPage("/dashboard");
  return (
    <ConsoleShell staff={staff} nav={navFor(staff.permissions)}>
      {children}
    </ConsoleShell>
  );
}
