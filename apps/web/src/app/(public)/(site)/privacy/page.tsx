import type { Metadata } from "next";
import { LegalPage } from "@/components/public/common/LegalPage";
import { getSitePage, withSeoOverride } from "@showbuzz/core/services/site-content.service";
import { formatMonthYear } from "@showbuzz/utils/dates";

/** SEO overrides from the admin console apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/privacy", { title: "Privacy Policy" });
}

/** Content edited in the admin console (Website Pages); the built-in text until it is saved and published. */
export default async function PrivacyPage() {
  const page = await getSitePage("privacy");
  return (
    <LegalPage content={page.content} updated={page.updatedAt ? formatMonthYear(new Date(page.updatedAt)) : "August 2026"} />
  );
}
