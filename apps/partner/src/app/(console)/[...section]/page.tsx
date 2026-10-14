import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { findPartnerNavItem } from "@/lib/nav";

/**
 * Every menu page not built yet (venues, shows, bookings, ...): known path → "Coming soon". Built pages (dashboard,
 * profile) have their own routes, which take precedence over this catch-all.
 */

export async function generateMetadata({ params }: PageProps<"/[...section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: findPartnerNavItem(`/${section.join("/")}`)?.label ?? "Not found" };
}

export default async function SectionPage({ params }: PageProps<"/[...section]">) {
  const { section } = await params;
  const path = `/${section.join("/")}`;
  const item = findPartnerNavItem(path);
  if (!item) notFound();

  await requireVendorPage(path);
  return <ComingSoon title={item.label} />;
}
