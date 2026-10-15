import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listLanguagesAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { LanguageForm } from "@/components/master/LanguageForm";

export const metadata: Metadata = { title: "Edit language" };

export default async function EditLanguagePage({ params }: PageProps<"/languages/[languageId]/edit">) {
  const { languageId } = await params;
  const { staff } = await requireStaffPage(`/languages/${languageId}/edit`);
  if (!hasPermission(staff.permissions, "languages:write")) return <NoAccess title="Edit language" />;
  const language = (await listLanguagesAdmin()).find((l) => l.id === languageId);
  if (!language) notFound();
  return (
    <>
      <PageHeader title={`Edit ${language.name}`} crumb="Languages" subtitle={`Used by ${language.movies} film(s).`} />
      <Card className="max-w-xl p-6">
        <LanguageForm
          languageId={language.id}
          defaults={{ name: language.name, nativeName: language.nativeName, status: language.status }}
        />
      </Card>
    </>
  );
}
