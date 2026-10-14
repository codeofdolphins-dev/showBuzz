import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { MovieSearch } from "@/components/movies/MovieSearch";

export const metadata: Metadata = { title: "Add movie" };

/** Search the shared catalogue first; "Create new film" only when it isn't there. */
export default async function AddMoviePage() {
  await requireVendorPage("/movies/add");
  return (
    <>
      <PageHeader
        title="Add movie"
        crumb="Movies"
        subtitle="Every film has one page on ShowBuzz listing all the cinemas that show it. Find yours and add it."
      />
      <MovieSearch />
    </>
  );
}
