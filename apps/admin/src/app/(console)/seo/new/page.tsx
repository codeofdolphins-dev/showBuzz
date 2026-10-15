import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { SeoEntryForm } from "@/components/content/SeoForms";

export const metadata: Metadata = { title: "Add SEO override" };

export default async function NewSeoEntryPage() {
  const { staff } = await requireStaffPage("/seo/new");
  if (!hasPermission(staff.permissions, "seo:write")) return <NoAccess title="Add SEO override" />;
  return (
    <>
      <PageHeader title="Add SEO override" crumb="SEO" />
      <Card className="max-w-2xl p-6">
        <SeoEntryForm />
      </Card>
    </>
  );
}
