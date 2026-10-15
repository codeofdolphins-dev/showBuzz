import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getMasterOptions } from "@showbuzz/core/services/master-data.service";
import { MovieForm } from "@/components/movies/MovieForm";

export const metadata: Metadata = { title: "Create film" };

/** Prototype movie-form.html for a film that isn't in the catalogue yet. */
export default async function NewMoviePage({ searchParams }: PageProps<"/movies/new">) {
  await requireVendorPage("/movies/new");
  const title = (param(await searchParams, "title") ?? "").slice(0, 150);
  const options = await getMasterOptions();
  return (
    <>
      <PageHeader
        title="Create film"
        crumb="Movies"
        subtitle="It joins the ShowBuzz catalogue and your movies. Only you (and ShowBuzz) can edit it."
      />
      <MovieForm initialTitle={title} options={{ languages: options.languages, genres: options.movieGenres }} />
    </>
  );
}
