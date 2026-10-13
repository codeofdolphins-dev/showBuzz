import Link from "next/link";
import { Clapperboard, Languages, Play } from "lucide-react";
import { EventCard } from "@/components/public/cards/EventCard";
import { SectionHeading } from "@/components/public/common/SectionHeading";
import { CategoryHubs } from "@/components/public/home/CategoryHubs";
import { CityCinemas } from "@/components/public/home/CityCinemas";
import { HeroCarousel, type HeroSlide } from "@/components/public/home/HeroCarousel";
import { MovieCarousel } from "@/components/public/home/MovieCarousel";
import { formatINR } from "@showbuzz/utils/money";
import {
  EVENT_SECTION_PATH,
  getEventById,
  getMovieById,
  listCinemas,
  listEvents,
  listMovies,
} from "@showbuzz/core/services/catalog.service";

const BROWSE_LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Malayalam"];
const BROWSE_GENRES = ["Action", "Sci-Fi", "Romance", "Animation", "Mythology"];

async function getHeroSlides(): Promise<HeroSlide[]> {
  const [movie, concert, match] = await Promise.all([
    getMovieById("mov-1"),
    getEventById("eve-1"),
    getEventById("spo-1"),
  ]);
  const slides: HeroSlide[] = [];
  if (movie) {
    slides.push({
      id: movie.id,
      image: movie.poster.replace("w=800", "w=1600"),
      badge: "Blockbuster • IMAX 3D",
      badgeIcon: "zap",
      tone: "rose",
      title: movie.title,
      blurb:
        "The cosmic sci-fi spectacle of 2026. Watch in IMAX 3D with laser projection and heart-thumping Dolby Atmos sound.",
      ctaLabel: "Book Now",
      ctaHref: `/movies/${movie.slug}`,
      trailer: { title: movie.title, url: movie.trailerUrl },
    });
  }
  if (concert) {
    slides.push({
      id: concert.id,
      image: concert.backdrop ?? concert.poster,
      badge: "Live Music Festival",
      badgeIcon: "music",
      tone: "purple",
      title: "Cosmic Odyssey: Sunburn 2026",
      blurb: "6 hours of pure euphoric beats, laser pyrotechnics, and top international DJs in Kolkata!",
      ctaLabel: `Passes From ${formatINR(Math.min(...concert.ticketTiers.map((t) => t.pricePaise)))}`,
      ctaHref: `${EVENT_SECTION_PATH.event}/${concert.slug}`,
    });
  }
  if (match) {
    slides.push({
      id: match.id,
      image: match.backdrop ?? match.poster,
      badge: "Stadium Live Action",
      badgeIcon: "trophy",
      tone: "emerald",
      title: "T20 Super League at Eden Gardens",
      blurb: "Kolkata Thunder vs Mumbai Blasters. Catch every sixer live under floodlights.",
      ctaLabel: "Match Seats",
      ctaHref: `${EVENT_SECTION_PATH.sport}/${match.slug}`,
    });
  }
  return slides;
}

export default async function HomePage() {
  const [slides, movies, events, cinemas] = await Promise.all([
    getHeroSlides(),
    listMovies(),
    listEvents("event"),
    listCinemas(),
  ]);

  return (
    <main className="flex-1 pb-16">
      <CategoryHubs />

      <section className="mt-4 w-full px-3 sm:mt-6 sm:px-6 lg:px-8 xl:px-12">
        <HeroCarousel slides={slides} />
      </section>

      <section className="mt-8 w-full px-4 sm:mt-12 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Trending In Cinemas" title="Recommended Movies" href="/movies" />
        <MovieCarousel movies={movies} />
      </section>

      <section className="mt-10 w-full px-4 sm:mt-14 sm:px-6 lg:px-8">
        <div className="relative flex flex-col items-center justify-between gap-5 overflow-hidden rounded-3xl border border-indigo-900/50 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl sm:p-8 md:flex-row">
          <div className="relative z-10 flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 shadow-lg sm:h-14 sm:w-14">
              <Play className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-rose-500 px-1.5 text-[9px] font-extrabold text-white uppercase">
                  Exclusive
                </span>
                <span className="text-xs font-bold text-indigo-300">ShowBuzz Premiere Stream</span>
              </div>
              <h4 className="mt-0.5 text-base font-black text-white sm:text-xl">Rent or Buy New Releases in 4K HDR</h4>
            </div>
          </div>
          <Link
            href="/stream"
            className="w-full tap-active gradient-btn rounded-xl px-5 py-2.5 text-center text-xs font-extrabold whitespace-nowrap text-white shadow-lg shadow-rose-500/30 sm:w-auto"
          >
            Explore Stream &rarr;
          </Link>
        </div>
      </section>

      <section className="mt-10 w-full px-4 sm:mt-14 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Best of Live"
          eyebrowClassName="text-purple-600"
          title="Popular Events & Gigs"
          href="/events"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} href={`${EVENT_SECTION_PATH.event}/${event.slug}`} />
          ))}
        </div>
      </section>

      <section className="mt-10 w-full px-4 sm:mt-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
              <Languages className="h-4 w-4 text-rose-500" /> Browse Movies by Language
            </h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {BROWSE_LANGUAGES.map((language) => (
                <Link
                  key={language}
                  href={`/movies?language=${language}`}
                  className="tap-active rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600"
                >
                  {language}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
              <Clapperboard className="h-4 w-4 text-purple-500" /> Explore by Genre
            </h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {BROWSE_GENRES.map((genre) => (
                <Link
                  key={genre}
                  href={`/movies?genre=${genre}`}
                  className="tap-active rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600"
                >
                  {genre}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 w-full px-4 sm:mt-14 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Multiplexes Near You"
          eyebrowClassName="text-blue-600"
          title="Popular Cinemas"
          href="/cinemas"
          linkLabel="View All"
        />
        <CityCinemas cinemas={cinemas} />
      </section>

      <section className="mt-12 w-full px-4 sm:mt-16 sm:px-6 lg:px-8">
        <div className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-rose-600 to-purple-700 p-6 text-white shadow-xl sm:p-10 md:flex-row">
          <div className="relative z-10 max-w-xl">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold tracking-wider text-white uppercase">
              For Artists & Organizers
            </span>
            <h3 className="mt-2 text-xl font-black text-white sm:text-3xl">Host Your Show on ShowBuzz</h3>
            <p className="mt-1 text-xs leading-relaxed text-rose-100">
              Reach millions of fans with end-to-end ticketing, fast QR gate scanning and daily payouts.
            </p>
          </div>
          <div className="relative z-10 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link
              href="/list-your-show"
              className="tap-active rounded-xl bg-white px-5 py-3 text-center text-xs font-extrabold text-rose-600 shadow-lg hover:bg-slate-50"
            >
              List Your Show Now
            </Link>
            <Link
              href="/corporate"
              className="tap-active rounded-xl border border-white/30 bg-white/20 px-5 py-3 text-center text-xs font-bold text-white"
            >
              Corporate Bookings
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
