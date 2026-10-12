"use client";

import { useState } from "react";
import { Film, SlidersHorizontal } from "lucide-react";
import { MovieCard } from "@/components/public/cards/MovieCard";
import { CityName } from "@/components/public/common/CityName";
import { EmptyState } from "@/components/public/common/EmptyState";
import { PageHeader } from "@/components/public/common/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import type { Movie, MovieSort, MovieStatus } from "@/schemas/movie";

const FILTER_GROUPS = [
  { key: "languages", title: "Languages", options: ["English", "Hindi", "Bengali", "Tamil", "Telugu"] },
  { key: "genres", title: "Genres", options: ["Action", "Sci-Fi", "Thriller", "Romance", "Animation", "Drama"] },
  { key: "formats", title: "Format", options: ["2D", "3D", "IMAX 3D", "4DX"] },
] as const;

type FilterKey = (typeof FILTER_GROUPS)[number]["key"];
type Filters = Record<FilterKey, string[]>;

const EMPTY_FILTERS: Filters = { languages: [], genres: [], formats: [] };

interface MovieBrowserProps {
  movies: Movie[];
  initialStatus: MovieStatus;
  initialLanguage?: string;
  initialGenre?: string;
}

function applyFilters(movies: Movie[], status: MovieStatus, filters: Filters, sort: MovieSort) {
  const matchesAny = (values: string[], selected: string[]) =>
    selected.length === 0 || values.some((v) => selected.includes(v));

  const list = movies.filter(
    (m) =>
      m.status === status &&
      matchesAny(m.languages, filters.languages) &&
      matchesAny(m.genres, filters.genres) &&
      matchesAny(m.formats, filters.formats),
  );
  if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating);
  if (sort === "newest") return [...list].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  return list;
}

export function MovieBrowser({ movies, initialStatus, initialLanguage, initialGenre }: MovieBrowserProps) {
  const [status, setStatus] = useState<MovieStatus>(initialStatus);
  const [sort, setSort] = useState<MovieSort>("popularity");
  const [filters, setFilters] = useState<Filters>({
    languages: initialLanguage ? [initialLanguage] : [],
    genres: initialGenre ? [initialGenre] : [],
    formats: [],
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const visible = applyFilters(movies, status, filters, sort);

  const toggle = (key: FilterKey, value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const clearAll = () => setFilters(EMPTY_FILTERS);

  const statusTabs = (
    <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
      {(
        [
          ["now-showing", "Now Showing"],
          ["upcoming", "Upcoming"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setStatus(value)}
          className={cn(
            "tap-active rounded-lg px-4 py-1.5 transition-all",
            status === value ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const sortSelect = (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as MovieSort)}
      aria-label="Sort movies"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:border-rose-500 focus:outline-none"
    >
      <option value="popularity">Sort By: Popularity</option>
      <option value="rating">Highest Rated</option>
      <option value="newest">Release Date: Newest</option>
    </select>
  );

  const filterPanel = (
    <div>
      {FILTER_GROUPS.map((group, i) => (
        <div key={group.key} className={cn("py-4", i < FILTER_GROUPS.length - 1 && "border-b border-slate-100")}>
          <h4 className="mb-3 text-xs font-extrabold tracking-wider text-slate-700 uppercase">{group.title}</h4>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => {
              const active = filters[group.key].includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(group.key, option)}
                  aria-pressed={active}
                  className={cn(
                    "tap-active rounded-lg px-3 py-1 text-xs font-medium",
                    active ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs lg:hidden">
        <span className="text-xs font-black text-slate-900">
          Movies in <CityName className="text-rose-600" />
        </span>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="tap-active flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-rose-500" /> Filter
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
        {statusTabs}
        {sortSelect}
      </div>

      <PageHeader
        className="hidden lg:flex"
        crumb="Movies"
        title={
          <>
            Movies in <CityName className="text-rose-600" />
          </>
        }
        description="Explore now showing blockbusters and upcoming theatrical releases"
        actions={
          <div className="flex items-center gap-3">
            {statusTabs}
            {sortSelect}
          </div>
        }
      />

      <div className="mt-2 grid grid-cols-1 gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-4 xl:grid-cols-5">
        <aside className="hidden space-y-6 lg:col-span-1 lg:block">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <SlidersHorizontal className="h-3.5 w-3.5 text-rose-500" /> Filters
              </h3>
              <button type="button" onClick={clearAll} className="tap-active text-xs font-bold text-rose-600 hover:underline">
                Clear All
              </button>
            </div>
            {filterPanel}
          </div>
        </aside>

        <div className="lg:col-span-3 xl:col-span-4">
          {visible.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} priority={i < 4} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Film}
              title="No movies match your filters"
              description="Try clearing some filters or searching another title."
              action={
                <button
                  type="button"
                  onClick={clearAll}
                  className="gradient-btn tap-active rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md"
                >
                  Reset Filters
                </button>
              }
            />
          )}
        </div>
      </div>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter Movies">
        {filterPanel}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={clearAll}
            className="tap-active flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="gradient-btn tap-active flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-md"
          >
            Show {visible.length} Movies
          </button>
        </div>
      </Modal>
    </>
  );
}
