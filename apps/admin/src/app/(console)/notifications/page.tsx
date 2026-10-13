import type { Metadata } from "next";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ComingSoon } from "@/components/console/PageParts";

export const metadata: Metadata = { title: "Notifications" };

/** Placeholder behind the topbar bell until the notifications batch (7.8). */
export default async function NotificationsPage() {
  await requireStaffPage("/notifications");
  return <ComingSoon title="Notifications" />;
}
