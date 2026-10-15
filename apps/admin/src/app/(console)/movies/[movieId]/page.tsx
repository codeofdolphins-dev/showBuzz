import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getMovieAdmin } from "@showbuzz/core/services/admin/movie-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDuration } from "@showbuzz/utils/dates";
import { MergeMovie } from "@/components/movies/MergeMovie";

export const metadata: Metadata = { title: "Film" };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}

/** One catalogue film: who added it, which vendors list it, its shows, "Edit film" and "merge into…" for duplicates. */
export default async function MoviePage({ params }: PageProps<"/movies/[movieId]">) {
  const { movieId } = await params;
  const { staff } = await requireStaffPage(`/movies/${movieId}`);
  if (!hasPermission(staff.permissions, "movies:read")) return <NoAccess title="Film" />;
  const movie = await getMovieAdmin(movieId, new Date());
  if (!movie) notFound();

  return (
    <>
      <PageHeader
        title={movie.title}
        crumb="Movies Catalog"
        subtitle={`${movie.certificate} · ${formatDuration(movie.durationMinutes)} · ${movie.languages.join(", ")} · released ${movie.releaseDate}`}
        actions={
          !movie.archived && hasPermission(staff.permissions, "movies:write") ? (
            <LinkButton href={`/movies/${movie.id}/edit`}>Edit film</LinkButton>
          ) : null
        }
      />
      {movie.archived ? (
        <p
          role="status"
          className="rounded-lg border border-admin-border bg-slate-50 px-4 py-3 text-xs text-admin-muted"
        >
          Archived: merged into{" "}
          {movie.mergedIntoId ? (
            <Link href={`/movies/${movie.mergedIntoId}`} className="font-bold text-admin-indigo hover:underline">
              {movie.mergedIntoTitle ?? "another film"}
            </Link>
          ) : (
            "another film"
          )}
          . Its public page redirects there.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[12rem_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue URLs (vendor-supplied too) */}
        <img src={movie.poster} alt="" className="w-48 rounded-xl border border-admin-border object-cover" />
        <Card className="space-y-4 p-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="Status">
              {movie.archived ? (
                <StatusBadge status="archived" />
              ) : (
                <StatusBadge tone={movie.status === "now-showing" ? "success" : "info"}>
                  {movie.status === "now-showing" ? "Now showing" : "Upcoming"}
                </StatusBadge>
              )}
            </Fact>
            <Fact label="Added by">{movie.createdBy}</Fact>
            <Fact label="Public URL">
              <span className="font-mono">/movies/{movie.slug}</span>
            </Fact>
            <Fact label="Genres">{movie.genres.join(", ") || "—"}</Fact>
            <Fact label="Shows">
              {movie.upcomingShows} upcoming · {movie.totalShows} in total
            </Fact>
            <Fact label="Customer reviews">{movie.reviews}</Fact>
          </dl>
          <Fact label={`Vendors listing it (${movie.vendors})`}>{movie.vendorNames.join(", ") || "None yet"}</Fact>
          {movie.mergedFrom.length ? (
            <Fact label="Duplicates merged into it">
              {movie.mergedFrom.map((m, i) => (
                <span key={m.id}>
                  {i ? ", " : ""}
                  <Link href={`/movies/${m.id}`} className="text-admin-indigo hover:underline">
                    {m.title}
                  </Link>
                </span>
              ))}
            </Fact>
          ) : null}
          <p className="text-xs text-admin-muted">{movie.synopsis}</p>
        </Card>
      </div>
      {!movie.archived && hasPermission(staff.permissions, "movies:write") ? (
        <Card className="max-w-2xl space-y-3 p-5">
          <h2 className="text-sm font-bold text-admin-dark">Merge duplicate</h2>
          <MergeMovie sourceId={movie.id} sourceTitle={movie.title} />
        </Card>
      ) : null}
    </>
  );
}
