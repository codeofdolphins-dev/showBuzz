import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getMasterOptions } from "@showbuzz/core/services/master-data.service";
import { getVendorMovie } from "@showbuzz/core/services/partner/movie.service";
import { MovieForm } from "@/components/movies/MovieForm";

export const metadata: Metadata = { title: "Edit film" };

/** Only the vendor that created the film may edit it; anyone else is sent to the read-only page. */
export default async function EditMoviePage({ params }: PageProps<"/movies/[movieId]/edit">) {
  const { movieId } = await params;
  const { vendor } = await requireVendorPage(`/movies/${movieId}/edit`);
  const detail = await getVendorMovie(vendor.id, movieId, new Date());
  if (!detail) notFound();
  if (!detail.own || !detail.values) redirect(`/movies/${movieId}`);
  const options = await getMasterOptions();

  return (
    <>
      <PageHeader title={`Edit ${detail.movie.title}`} crumb="Movies" />
      <MovieForm
        movie={{ id: movieId, values: detail.values }}
        options={{ languages: options.languages, genres: options.movieGenres }}
      />
    </>
  );
}
