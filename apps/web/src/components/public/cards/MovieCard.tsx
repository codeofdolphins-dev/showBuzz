import Image from "next/image";
import Link from "next/link";
import { Flame, Star } from "lucide-react";
import { WishlistButton } from "@/components/public/common/WishlistButton";
import type { Movie } from "@showbuzz/schemas/movie";

interface MovieCardProps {
  movie: Movie;
  priority?: boolean;
}

export function MovieCard({ movie, priority }: MovieCardProps) {
  const bookHref = movie.status === "now-showing" ? `/cinemas?movie=${movie.slug}` : `/movies/${movie.slug}`;

  return (
    <article className="premium-card group relative flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        <Image
          src={movie.poster}
          alt={movie.title}
          fill
          priority={priority}
          sizes="(min-width: 1536px) 16vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <WishlistButton
          id={movie.id}
          className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-white/85 text-slate-700 shadow-md backdrop-blur-md hover:text-rose-600 sm:h-8 sm:w-8"
        />
        {movie.rating > 0 ? (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-slate-950/85 px-2 py-0.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            <span>{movie.rating}/10</span>
            <span className="text-[9px] font-normal text-slate-300">({movie.votesLabel})</span>
            {movie.userRating && (
              <span
                className="border-l border-white/20 pl-1.5 text-[9px] font-semibold text-amber-300"
                title={`${movie.userRating.count} ShowBuzz ${movie.userRating.count === 1 ? "review" : "reviews"}`}
              >
                ★{movie.userRating.average}/5
              </span>
            )}
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">
            <Flame className="h-2.5 w-2.5" /> {movie.votesLabel}
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
          {movie.formats.slice(0, 2).map((f) => (
            <span key={f} className="rounded bg-black/60 px-1.5 text-[8.5px] font-extrabold text-white backdrop-blur-md">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <h4
            className="line-clamp-1 text-sm font-bold text-slate-900 transition-colors group-hover:text-rose-600 sm:text-base"
            title={movie.title}
          >
            {movie.title}
          </h4>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 sm:text-xs">{movie.genres.join(", ")}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400 sm:text-[11px]">
            {movie.languages.join(", ")} &bull; {movie.certificate}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
          <Link
            href={`/movies/${movie.slug}`}
            className="flex-1 rounded-xl bg-slate-100 py-1.5 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Details
          </Link>
          <Link
            href={bookHref}
            className="gradient-btn flex-1 rounded-xl py-1.5 text-center text-xs font-bold text-white shadow-md shadow-rose-500/20"
          >
            {movie.status === "now-showing" ? "Book" : "Notify"}
          </Link>
        </div>
      </div>
    </article>
  );
}
