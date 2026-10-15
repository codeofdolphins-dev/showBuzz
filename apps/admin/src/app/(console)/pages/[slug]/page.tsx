import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getSitePageForm } from "@showbuzz/core/services/admin/content-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { SITE_PAGE_META, sitePageSlugSchema } from "@showbuzz/schemas/site-content";
import { AboutPageEditor, FaqPageEditor, LegalPageEditor } from "@/components/content/PageEditors";

export const metadata: Metadata = { title: "Edit page" };

/** One website page's editor (the right structured form for About, Privacy, Terms or FAQ). */
export default async function EditSitePage({ params }: PageProps<"/pages/[slug]">) {
  const parsed = sitePageSlugSchema.safeParse((await params).slug);
  if (!parsed.success) notFound();
  const slug = parsed.data;
  const { staff } = await requireStaffPage(`/pages/${slug}`);
  if (!hasPermission(staff.permissions, "pages:read")) return <NoAccess title="Edit page" />;
  const meta = SITE_PAGE_META[slug];

  const header = (
    <PageHeader
      title={`Edit ${meta.name}`}
      crumb="Website Pages"
      subtitle={`showbuzz.com${meta.path}`}
    />
  );
  if (!hasPermission(staff.permissions, "pages:write")) {
    return (
      <>
        {header}
        <Card className="p-6 text-xs text-admin-muted">Your role can view the page list but not edit pages.</Card>
      </>
    );
  }

  if (slug === "faq") {
    const page = await getSitePageForm("faq");
    return (
      <>
        {header}
        <FaqPageEditor status={page.status} content={page.content} />
      </>
    );
  }
  if (slug === "about") {
    const page = await getSitePageForm("about");
    return (
      <>
        {header}
        <AboutPageEditor status={page.status} content={page.content} />
      </>
    );
  }
  const page = await getSitePageForm(slug);
  return (
    <>
      {header}
      <LegalPageEditor slug={slug} status={page.status} content={page.content} />
    </>
  );
}
