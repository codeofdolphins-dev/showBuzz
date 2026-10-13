import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Clock, Play, Star, Tags, Ticket } from "lucide-react";
import { ShareButton } from "@/components/public/common/ShareButton";
import { TrailerButton } from "@/components/public/common/TrailerButton";
import { WishlistButton } from "@/components/public/common/WishlistButton";
import { ReviewDialog } from "@/components/public/movie/ReviewDialog";
import { formatDateLong, formatDateShort, formatDuration } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import type { Movie } from "@showbuzz/schemas/movie";
import { getMovieBySlug, listCinemas, listMovies } from "@showbuzz/core/services/catalog.service";
import { listMovieReviews } from "@showbuzz/core/services/review.service";

export async function generateStaticParams() {
  const movies = await listMovies();
  return movies.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/movies/[slug]">): Promise<Metadata> {
  const movie = await getMovieBySlug((await params).slug);
  if (!movie) return { title: "Movie not found" };
  return {
    title: `${movie.title} - Book Tickets Online`,
    description: movie.synopsis,
    openGraph: { images: [movie.poster] },
  };
}

async function Reviews({ movieId }: { movieId: string }) {
  await connection();
  const reviews = await listMovieReviews(movieId);
  if (reviews.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400 italic">No reviews yet. Be the first to rate it!</p>;
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                {r.author.charAt(0)}
              </span>
              <span className="text-xs font-bold text-slate-800">{r.author}</span>
              <span className="text-[9px] text-slate-400">{formatDateShort(new Date(r.createdAt))}</span>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
              <Star className="h-2.5 w-2.5 fill-current" /> {r.rating}/5
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

function BookCta({ movie, className }: { movie: Movie; className: string }) {
  if (movie.status !== "now-showing") {
    return (
      <span className={className}>
        <Clock className="h-4 w-4" /> Releasing {formatDateLong(new Date(`${movie.releaseDate}T00:00:00+05:30`))}
      </span>
    );
  }
  return (
    <Link href={`/cinemas?movie=${movie.slug}`} className={className}>
      <Ticket className="h-4 w-4" /> Book Tickets
    </Link>
  );
}

export default async function MovieDetailsPage({ params }: PageProps<"/movies/[slug]">) {
  const movie = await getMovieBySlug((await params).slug);
  if (!movie) notFound();

  const cinemas = await listCinemas();
  const fromPaise = Math.min(...cinemas.flatMap((c) => c.showTemplates.map((t) => t.pricePaise)));
  const nowShowing = movie.status === "now-showing";

  return (
    <main className="flex-1 pb-24 lg:pb-16">
      <section className="relative flex min-h-[360px] items-center overflow-hidden bg-slate-950 text-white sm:min-h-[460px]">
        <Image
          src={movie.backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25 mix-blend-luminosity blur-xs"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

        <div className="relative z-10 w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="flex flex-col items-center gap-6 sm:gap-8 md:flex-row">
            <div className="group relative w-36 shrink-0 overflow-hidden rounded-2xl border-2 border-white/10 shadow-2xl sm:w-56">
              <Image
                src={movie.poster}
                alt={movie.title}
                width={448}
                height={672}
                priority
                className="aspect-[2/3] w-full object-cover"
              />
              <TrailerButton
                title={movie.title}
                url={movie.trailerUrl}
                className="absolute inset-0 flex tap-active flex-col items-center justify-center gap-1.5 bg-black/40 text-white backdrop-blur-xs"
              >
                <span className="flex h-10 w-10 gradient-btn items-center justify-center rounded-full shadow-lg sm:h-12 sm:w-12">
                  <Play className="ml-0.5 h-4 w-4 fill-current sm:h-5 sm:w-5" />
                </span>
                <span className="text-[10px] font-bold tracking-wide uppercase sm:text-xs">Play Trailer</span>
              </TrailerButton>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 md:justify-start">
                <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-300 uppercase">
                  {nowShowing ? "Now Showing" : "Upcoming"}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
                  {movie.certificate}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                  <Clock className="h-3 w-3" /> {formatDuration(movie.durationMinutes)}
                </span>
              </div>

              <h1 className="text-2xl leading-tight font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                {movie.title}
              </h1>

              <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <div className="text-left">
                    {movie.rating > 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-white sm:text-base">{movie.rating}</span>
                        <span className="text-[10px] text-slate-300">/10</span>
                      </div>
                    ) : (
                      <span className="text-sm font-black text-white">New</span>
                    )}
                    <span className="block text-[9px] text-slate-300">({movie.votesLabel})</span>
                  </div>
                </div>
                <span className="h-6 w-px bg-white/20" />
                <ReviewDialog
                  movieId={movie.id}
                  label="Rate Now"
                  disabled={!nowShowing}
                  className="tap-active rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/20"
                />
              </div>
              {movie.userRating && (
                <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-amber-300 md:justify-start">
                  <Star className="h-3 w-3 fill-current" />
                  {movie.userRating.average}/5 &middot; {movie.userRating.count}{" "}
                  {movie.userRating.count === 1 ? "review" : "reviews"} on ShowBuzz
                </p>
              )}

              <div className="mt-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs md:justify-start">
                  <span className="text-[11px] text-slate-400">Languages:</span>
                  {movie.languages.map((l) => (
                    <span key={l} className="rounded bg-white/10 px-2 text-[11px] font-semibold text-white">
                      {l}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs md:justify-start">
                  <span className="text-[11px] text-slate-400">Formats:</span>
                  {movie.formats.map((f) => (
                    <span
                      key={f}
                      className="rounded border border-rose-500/40 bg-rose-500/30 px-2 text-[10px] font-extrabold text-rose-200"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 hidden items-center gap-3 md:flex">
                <BookCta
                  movie={movie}
                  className="flex tap-active gradient-btn items-center gap-2 rounded-2xl px-7 py-3 text-xs font-black text-white shadow-xl shadow-rose-500/30 transition-transform hover:scale-105 sm:text-sm"
                />
                <WishlistButton
                  id={movie.id}
                  className="h-10 w-10 tap-active rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  activeClassName="text-rose-500"
                  iconClassName="h-4 w-4"
                />
                <ShareButton
                  title={movie.title}
                  className="flex h-10 w-10 tap-active items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 w-full px-4 sm:mt-10 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-6 lg:col-span-2 xl:col-span-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7">
              <h3 className="mb-2 text-base font-extrabold text-slate-900 sm:text-lg">About the Movie</h3>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">{movie.synopsis}</p>
              <p className="mt-3 text-xs text-slate-500">
                Directed by <strong className="text-slate-800">{movie.director}</strong>
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7">
              <h3 className="mb-3 text-base font-extrabold text-slate-900 sm:text-lg">Cast</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {movie.cast.map((c) => (
                  <div key={`${c.name}-${c.role}`} className="group text-center">
                    <div className="mx-auto mb-1.5 h-16 w-16 overflow-hidden rounded-full border-2 border-slate-100 shadow-md transition-transform group-hover:scale-105 sm:h-20 sm:w-20">
                      <Image
                        src={c.image}
                        alt={c.name}
                        width={160}
                        height={160}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <h5 className="truncate text-xs font-bold text-slate-900">{c.name}</h5>
                    <p className="truncate text-[10px] text-slate-400">{c.role}</p>
                  </div>
                ))}
              </div>
              {movie.crew.length > 0 && (
                <>
                  <h4 className="mt-5 mb-2 text-sm font-extrabold text-slate-900">Crew</h4>
                  <div className="flex flex-wrap gap-2">
                    {movie.crew.map((c) => (
                      <span
                        key={`${c.name}-${c.role}`}
                        className="rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600"
                      >
                        <strong className="text-slate-800">{c.name}</strong> &bull; {c.role}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 sm:text-lg">User Reviews</h3>
                  <p className="text-[11px] text-slate-500">Verified ticket holder ratings</p>
                </div>
                <ReviewDialog
                  movieId={movie.id}
                  label="Write Review"
                  disabled={!nowShowing}
                  className="tap-active rounded-xl border border-rose-500 px-3 py-1.5 text-xs font-bold text-rose-600"
                />
              </div>
              <Suspense fallback={<div className="h-24 skeleton" />}>
                <Reviews movieId={movie.id} />
              </Suspense>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-900 sm:text-sm">
                <Tags className="h-4 w-4 text-rose-500" /> Applicable Offers
              </h4>
              <div className="space-y-2">
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                  <p className="text-xs font-bold text-rose-700">Code: SHOW50</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">Flat 50% Off up to ₹150 for first time users</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="text-xs font-bold text-blue-700">HDFC Bank Card Offer</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">Buy 1 Get 1 Free on weekend showtimes</p>
                </div>
              </div>
              <Link href="/offers" className="mt-3 block text-xs font-bold text-rose-600 hover:underline">
                View all offers &rarr;
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <div className="fixed right-0 bottom-14 left-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-2xl backdrop-blur-md sm:bottom-16 lg:hidden">
        {nowShowing ? (
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Starting from</span>
            <span className="text-base font-black text-slate-900">
              {formatINR(fromPaise)} <span className="text-[10px] font-normal text-slate-500">onwards</span>
            </span>
          </div>
        ) : (
          <span className="text-xs font-bold text-slate-600">Bookings open soon</span>
        )}
        <BookCta
          movie={movie}
          className="flex tap-active gradient-btn items-center gap-1.5 rounded-xl px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-500/20"
        />
      </div>
    </main>
  );
}
