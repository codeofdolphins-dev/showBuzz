import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CalendarPlus, Lock, Pencil } from "lucide-react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorMovie } from "@showbuzz/core/services/partner/movie.service";
import { formatDuration } from "@showbuzz/utils/dates";
import { MovieListButton } from "@/components/movies/MovieListButton";
import { LinkButton } from "@/components/venues/LinkButton";

export const metadata: Metadata = { title: "Movie" };

/**
 * One catalogue film. The vendor that created it gets "Edit"; everyone else sees it read-only, and can add it to
 * their list and schedule it.
 */
export default async function MoviePage({ params }: PageProps<"/movies/[movieId]">) {
  const { movieId } = await params;
  const { vendor } = await requireVendorPage(`/movies/${movieId}`);
  const detail = await getVendorMovie(vendor.id, movieId, new Date());
  if (!detail) notFound();
  const { movie } = detail;

  return (
    <>
      <PageHeader
        title={movie.title}
        crumb="Movies"
        subtitle={`${movie.languages.join(", ")} · ${movie.certificate} · ${formatDuration(movie.durationMinutes)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {detail.own ? (
              <LinkButton href={`/movies/${movie.id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden /> Edit film
              </LinkButton>
            ) : null}
            <MovieListButton movieId={movie.id} title={movie.title} added={detail.added} />
            {detail.added ? (
              <LinkButton href={`/shows/new?movie=${movie.id}`}>
                <CalendarPlus className="h-4 w-4" aria-hidden /> Schedule shows
              </LinkButton>
            ) : null}
          </div>
        }
      />

      {detail.own ? null : (
        <p className="flex items-center gap-2 rounded-lg border border-admin-border bg-slate-50 px-4 py-3 text-xs text-admin-muted">
          <Lock className="h-4 w-4" aria-hidden /> Shared catalogue film added by {detail.createdBy}. Only they (and
          ShowBuzz) can edit its details. Ask ShowBuzz if something is wrong.
        </p>
      )}

      <Card className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[160px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue posters are arbitrary remote URLs */}
        <img src={movie.poster} alt="" className="aspect-[2/3] w-40 rounded-lg object-cover" />
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Term label="Status">
            <StatusBadge tone={movie.status === "now-showing" ? "success" : "warning"}>
              {movie.status === "now-showing" ? "Now showing" : "Coming soon"}
            </StatusBadge>
          </Term>
          <Term label="Release date">{movie.releaseDate}</Term>
          <Term label="Your upcoming shows">{detail.upcomingShows}</Term>
          <Term label="Genres">{movie.genres.join(", ")}</Term>
          <Term label="Formats">{movie.formats.join(", ")}</Term>
          <Term label="Director">{movie.director}</Term>
          <Term label="URL name">
            <span className="font-mono">/movies/{movie.slug}</span>
          </Term>
          <Term label="Rating">{movie.rating > 0 ? `${movie.rating.toFixed(1)}/10` : "Unrated"}</Term>
          <Term label="Trailer">
            <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="text-admin-indigo underline">
              Watch
            </a>
          </Term>
          <Term label="Synopsis" wide>
            <span className="font-normal whitespace-pre-line text-admin-text">{movie.synopsis}</span>
          </Term>
        </div>
      </Card>

      {movie.cast.length + movie.crew.length > 0 ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold text-admin-dark">Cast & crew</h2>
          <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {[...movie.cast, ...movie.crew].map((person, i) => (
              <li key={`${person.name}-${i}`}>
                <span className="font-semibold text-admin-dark">{person.name}</span>
                <span className="text-admin-muted"> · {person.role}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Term({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <p className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</p>
      <div className="mt-0.5 font-semibold text-admin-dark">{children}</div>
    </div>
  );
}
