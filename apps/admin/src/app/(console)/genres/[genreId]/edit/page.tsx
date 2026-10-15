import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listGenresAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { GenreForm } from "@/components/master/GenreForm";

export const metadata: Metadata = { title: "Edit genre" };

export default async function EditGenrePage({ params }: PageProps<"/genres/[genreId]/edit">) {
  const { genreId } = await params;
  const { staff } = await requireStaffPage(`/genres/${genreId}/edit`);
  if (!hasPermission(staff.permissions, "genres:write")) return <NoAccess title="Edit genre" />;
  const genre = (await listGenresAdmin()).find((g) => g.id === genreId);
  if (!genre) notFound();
  return (
    <>
      <PageHeader title={`Edit ${genre.name}`} crumb="Content Genres" subtitle={`Used by ${genre.listings} listing(s).`} />
      <Card className="max-w-xl p-6">
        <GenreForm
          genreId={genre.id}
          defaults={{ name: genre.name, slug: genre.slug, appliesTo: genre.appliesTo, status: genre.status }}
        />
      </Card>
    </>
  );
}
