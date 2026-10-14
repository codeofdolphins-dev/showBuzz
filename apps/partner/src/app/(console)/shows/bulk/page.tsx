import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVendorMovieOptions } from "@showbuzz/core/services/partner/movie.service";
import { listVenueScreenOptions } from "@showbuzz/core/services/partner/show-schedule.service";
import { istDateKey } from "@showbuzz/utils/dates";
import { ShowScheduler } from "@/components/shows/ShowScheduler";

export const metadata: Metadata = { title: "Daily schedule" };

/** Prototype show-form.html multi-date × multi-time scheduler: all shows are created, or none if any overlaps. */
export default async function BulkShowsPage({ searchParams }: PageProps<"/shows/bulk">) {
  const { vendor } = await requireVendorPage("/shows/bulk");
  const movieId = param(await searchParams, "movie");
  const [venues, movies] = await Promise.all([listVenueScreenOptions(vendor.id), listVendorMovieOptions(vendor.id)]);
  return (
    <>
      <PageHeader
        title="Daily schedule"
        crumb="Shows"
        subtitle="The same start times every day for a date range, on one screen."
      />
      <ShowScheduler
        mode="bulk"
        venues={venues.filter((v) => v.kind === "cinema" && v.screens.length > 0)}
        movies={movies}
        {...(movieId ? { initialMovieId: movieId } : {})}
        todayKey={istDateKey(new Date())}
      />
    </>
  );
}
