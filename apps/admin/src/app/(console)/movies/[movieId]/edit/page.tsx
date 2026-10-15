import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getMovieAdminValues } from "@showbuzz/core/services/admin/movie-admin.service";
import { getMasterOptions } from "@showbuzz/core/services/master-data.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { AdminMovieForm } from "@/components/movies/AdminMovieForm";

export const metadata: Metadata = { title: "Edit film" };

/** Prototype movie-form.html for any catalogue film, with the editorial fields only ShowBuzz sets. */
export default async function EditMoviePage({ params }: PageProps<"/movies/[movieId]/edit">) {
  const { movieId } = await params;
  const { staff } = await requireStaffPage(`/movies/${movieId}/edit`);
  if (!hasPermission(staff.permissions, "movies:write")) return <NoAccess title="Edit film" />;
  const [values, options] = await Promise.all([getMovieAdminValues(movieId), getMasterOptions()]);
  if (!values) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${values.title}`}
        crumb="Movies Catalog"
        subtitle="Changes show on the public film page and every cinema listing it. A new running time applies to shows scheduled from now on."
      />
      <AdminMovieForm
        movieId={movieId}
        values={values}
        options={{ languages: options.languages, genres: options.movieGenres }}
      />
    </>
  );
}
