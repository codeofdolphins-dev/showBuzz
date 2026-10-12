import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Clapperboard } from "lucide-react";
import { z } from "zod";
import { ShowtimeBrowser } from "@/components/public/cinema/ShowtimeBrowser";
import { EmptyState } from "@/components/public/common/EmptyState";
import { cn } from "@/lib/cn";
import { formatDuration, istDateKey, isDateKey, upcomingDays } from "@/lib/dates";
import { slugSchema } from "@/schemas/common";
import { getMovieBySlug, listMovies } from "@/server/services/catalog.service";
import { bookableDateKeys, listShowtimes } from "@/server/services/show.service";

export const metadata: Metadata = {
  title: "Cinemas & Showtimes",
  description: "Pick a cinema and showtime near you.",
};

const querySchema = z.object({
  movie: slugSchema.optional().catch(undefined),
  date: z.string().refine(isDateKey).optional().catch(undefined),
  cinema: slugSchema.optional().catch(undefined),
});

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Showtimes({ searchParams }: Pick<PageProps<"/cinemas">, "searchParams">) {
  const params = await searchParams;
  await connection();
  const now = new Date();
  const query = querySchema.parse({ movie: first(params.movie), date: first(params.date), cinema: first(params.cinema) });

  const movies = await listMovies();
  const movie =
    (query.movie && (await getMovieBySlug(query.movie))) || movies.find((m) => m.status === "now-showing");
  if (!movie) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="No movies are showing right now"
        description="Showtimes appear here as soon as new releases open for booking."
        action={
          <Link href="/movies" className="gradient-btn tap-active inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md">
            Browse Upcoming Movies &rarr;
          </Link>
        }
      />
    );
  }

  const dateKeys = bookableDateKeys(now);
  const selectedDate = query.date && dateKeys.includes(query.date) ? query.date : istDateKey(now);
  const days = upcomingDays(dateKeys[0] ?? selectedDate, dateKeys.length);
  const showtimes = await listShowtimes(movie.id, selectedDate, now);

  const dateHref = (key: string) => {
    const sp = new URLSearchParams({ movie: movie.slug, date: key });
    if (query.cinema) sp.set("cinema", query.cinema);
    return `/cinemas?${sp}`;
  };

  return (
    <>
      <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:mb-8 sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <Image
              src={movie.poster}
              alt={movie.title}
              width={128}
              height={192}
              className="h-20 w-14 shrink-0 rounded-2xl object-cover shadow-md sm:h-24 sm:w-16"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 text-[9px] font-extrabold text-slate-700 sm:text-[10px]">
                  {movie.certificate}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 sm:text-xs">{movie.languages.join(", ")}</span>
              </div>
              <h1 className="mt-0.5 text-base font-black tracking-tight text-slate-900 sm:mt-1 sm:text-2xl">{movie.title}</h1>
              <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">
                {movie.genres.join(" • ")} • {formatDuration(movie.durationMinutes)}
              </p>
            </div>
          </div>
          <Link
            href="/movies"
            className="tap-active self-start rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 md:self-auto"
          >
            Change Movie
          </Link>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 sm:mt-6 sm:pt-6">
          <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase sm:mb-3">Select Show Date</p>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1 sm:gap-3">
            {days.map((day) => {
              const active = day.key === selectedDate;
              return (
                <Link
                  key={day.key}
                  href={dateHref(day.key)}
                  replace
                  scroll={false}
                  aria-current={active ? "date" : undefined}
                  className={cn(
                    "tap-active flex min-w-[58px] flex-col items-center justify-center rounded-2xl border px-2.5 py-2 transition-all sm:min-w-[70px] sm:px-3 sm:py-2.5",
                    active
                      ? "border-rose-500 bg-rose-500 font-black text-white shadow-md shadow-rose-500/20"
                      : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <span className="text-[9px] font-bold tracking-wider uppercase opacity-80 sm:text-[10px]">{day.dayLabel}</span>
                  <span className="text-sm font-black sm:my-0.5 sm:text-base">{day.dayOfMonth}</span>
                  <span className="text-[8px] font-bold tracking-wider uppercase opacity-80 sm:text-[9px]">{day.monthLabel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {movie.status === "now-showing" ? (
        <ShowtimeBrowser
          showtimes={showtimes}
          cinemaFilter={
            query.cinema
              ? { slug: query.cinema, allHref: `/cinemas?${new URLSearchParams({ movie: movie.slug, date: selectedDate })}` }
              : undefined
          }
        />
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Bookings open soon</h3>
          <p className="mt-1 text-xs text-slate-500">Showtimes for {movie.title} will be announced closer to release.</p>
        </div>
      )}
    </>
  );
}

export default function CinemasPage({ searchParams }: PageProps<"/cinemas">) {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="skeleton h-48" />
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
        }
      >
        <Showtimes searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
