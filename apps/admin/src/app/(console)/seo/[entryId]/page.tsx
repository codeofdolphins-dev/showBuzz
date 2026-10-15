import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getSeoEntry } from "@showbuzz/core/services/admin/content-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { SeoEntryForm } from "@/components/content/SeoForms";

export const metadata: Metadata = { title: "Edit SEO override" };

export default async function EditSeoEntryPage({ params }: PageProps<"/seo/[entryId]">) {
  const { entryId } = await params;
  const { staff } = await requireStaffPage(`/seo/${entryId}`);
  if (!hasPermission(staff.permissions, "seo:write")) return <NoAccess title="Edit SEO override" />;
  const entry = await getSeoEntry(entryId);
  if (!entry) notFound();
  return (
    <>
      <PageHeader title={`SEO for ${entry.path}`} crumb="SEO" />
      <Card className="max-w-2xl p-6">
        <SeoEntryForm
          entryId={entry.id}
          defaults={{
            path: entry.path,
            title: entry.title,
            description: entry.description,
            ogImage: entry.ogImage,
            noindex: entry.noindex,
          }}
        />
      </Card>
    </>
  );
}
