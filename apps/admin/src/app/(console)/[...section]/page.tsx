import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { ComingSoon, NoAccess } from "@showbuzz/console-ui/PageParts";
import { findNavItem } from "@/lib/nav";

/**
 * Every menu page not built yet (movies, venues, ...): known path → permission check → "Coming soon". Built
 * pages (dashboard, profile, users) have their own routes, which take precedence over this catch-all.
 */

export async function generateMetadata({ params }: PageProps<"/[...section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findNavItem(`/${section.join("/")}`)?.label ?? "Not found" };
}

export default async function SectionPage({ params }: PageProps<"/[...section]">) {
  const { section } = await params;
  const path = `/${section.join("/")}`;
  const item = findNavItem(path);
  if (!item) notFound();

  const { staff } = await requireStaffPage(path);
  if (item.permission && !hasPermission(staff.permissions, item.permission)) return <NoAccess title={item.label} />;
  return <ComingSoon title={item.label} />;
}
