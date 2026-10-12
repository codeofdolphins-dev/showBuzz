import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieBrowser } from "@/components/public/movie/MovieBrowser";
import { movieListQuerySchema } from "@/schemas/movie";
import { listMovies } from "@/server/services/catalog.service";

export const metadata: Metadata = {
  title: "Movies",
  description: "Now showing blockbusters and upcoming theatrical releases near you.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Movies({ searchParams }: Pick<PageProps<"/movies">, "searchParams">) {
  const params = await searchParams;
  const query = movieListQuerySchema.parse({
    status: firstValue(params.status),
    language: firstValue(params.language),
    genre: firstValue(params.genre),
  });
  const movies = await listMovies();
  return (
    <MovieBrowser
      movies={movies}
      initialStatus={query.status}
      initialLanguage={query.language}
      initialGenre={query.genre}
    />
  );
}

function MoviesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="aspect-[3/5] skeleton" />
      ))}
    </div>
  );
}

export default function MoviesPage({ searchParams }: PageProps<"/movies">) {
  return (
    <main className="w-full flex-1 px-4 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <Suspense fallback={<MoviesSkeleton />}>
        <Movies searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
