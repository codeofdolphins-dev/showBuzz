import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { LanguageForm } from "@/components/master/LanguageForm";

export const metadata: Metadata = { title: "Add language" };

export default async function NewLanguagePage() {
  const { staff } = await requireStaffPage("/languages/new");
  if (!hasPermission(staff.permissions, "languages:write")) return <NoAccess title="Add language" />;
  return (
    <>
      <PageHeader title="Add language" crumb="Languages" />
      <Card className="max-w-xl p-6">
        <LanguageForm />
      </Card>
    </>
  );
}
