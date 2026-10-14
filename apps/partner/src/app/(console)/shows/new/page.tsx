import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVendorMovieOptions } from "@showbuzz/core/services/partner/movie.service";
import { listVenueScreenOptions } from "@showbuzz/core/services/partner/show-schedule.service";
import { istDateKey } from "@showbuzz/utils/dates";
import { ShowScheduler } from "@/components/shows/ShowScheduler";

export const metadata: Metadata = { title: "Schedule a show" };

/** Prototype show-form.html, one show. Sports fixtures are scheduled from their listing (Events → Sports). */
export default async function NewShowPage({ searchParams }: PageProps<"/shows/new">) {
  const { vendor } = await requireVendorPage("/shows/new");
  const movieId = param(await searchParams, "movie");
  const [venues, movies] = await Promise.all([listVenueScreenOptions(vendor.id), listVendorMovieOptions(vendor.id)]);
  return (
    <>
      <PageHeader title="Schedule a show" crumb="Shows" subtitle="One movie show on one of your screens." />
      <ShowScheduler
        mode="single"
        venues={venues.filter((v) => v.kind === "cinema" && v.screens.length > 0)}
        movies={movies}
        {...(movieId ? { initialMovieId: movieId } : {})}
        todayKey={istDateKey(new Date())}
      />
    </>
  );
}
