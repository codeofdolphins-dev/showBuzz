import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { GenreForm } from "@/components/master/GenreForm";

export const metadata: Metadata = { title: "Add genre" };

export default async function NewGenrePage() {
  const { staff } = await requireStaffPage("/genres/new");
  if (!hasPermission(staff.permissions, "genres:write")) return <NoAccess title="Add genre" />;
  return (
    <>
      <PageHeader title="Add genre" crumb="Content Genres" />
      <Card className="max-w-xl p-6">
        <GenreForm />
      </Card>
    </>
  );
}
