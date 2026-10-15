import type { Metadata } from "next";
import { LegalPage } from "@/components/public/common/LegalPage";
import { getSitePage, withSeoOverride } from "@showbuzz/core/services/site-content.service";
import { formatMonthYear } from "@showbuzz/utils/dates";

/** SEO overrides from the admin console apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/terms", { title: "Terms & Conditions" });
}

/** Content edited in the admin console (Website Pages); the built-in text until it is saved and published. */
export default async function TermsPage() {
  const page = await getSitePage("terms");
  return (
    <LegalPage content={page.content} updated={page.updatedAt ? formatMonthYear(new Date(page.updatedAt)) : "August 2026"} />
  );
}
