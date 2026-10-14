"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Card } from "@showbuzz/console-ui/PageParts";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { MOVIE_LANGUAGE_OPTIONS } from "@showbuzz/schemas/partner-listing";
import type { MovieSearchHit } from "@showbuzz/schemas/types/partner-listing";
import { formatDuration } from "@showbuzz/utils/dates";
import { addMovieAction, searchMoviesAction } from "@/app/_actions/movies";

const LANGUAGE_OPTIONS = MOVIE_LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }));
const SEARCH_DELAY_MS = 300;

/**
 * "Add movie": search the shared catalogue first (title, language, release year) and reuse the film; only if it
 * isn't there, create it.
 */
export function MovieSearch() {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("");
  const [year, setYear] = useState("");
  const [hits, setHits] = useState<MovieSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  const yearValid = /^(\d{4})?$/.test(year);
  const hasQuery = Boolean(q.trim() || language || (year && yearValid));

  useEffect(() => {
    clearTimeout(timer.current);
    if (!hasQuery) return;
    timer.current = setTimeout(async () => {
      const request = ++latest.current;
      setSearching(true);
      const result = await searchMoviesAction({ q, language, year: yearValid ? year : "" });
      if (request !== latest.current) return;
      setSearching(false);
      if (result.success) {
        setHits(result.data);
        setError(null);
      } else setError(result.error.message);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [q, language, year, yearValid, hasQuery]);

  function add(hit: MovieSearchHit) {
    setAddingId(hit.id);
    startTransition(async () => {
      const result = await addMovieAction(hit.id);
      setAddingId(null);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`${result.data.title} added to your movies. You can schedule shows now.`);
      setHits((current) => current?.map((h) => (h.id === hit.id ? { ...h, added: true } : h)) ?? null);
      router.refresh();
    });
  }

  const shown = hasQuery ? hits : null;
  const createHref = `/movies/new${q.trim() ? `?title=${encodeURIComponent(q.trim())}` : ""}`;

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[2fr_1fr_1fr]">
        <TextField
          label="Film title"
          placeholder="Start typing, e.g. Chrono"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          autoFocus
        />
        <SelectField
          label="Language"
          options={LANGUAGE_OPTIONS}
          placeholder="Any language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        />
        <TextField
          label="Release year"
          inputMode="numeric"
          placeholder="2026"
          maxLength={4}
          value={year}
          onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))}
          error={yearValid ? undefined : "Four digits"}
        />
      </Card>

      <div aria-live="polite" className="space-y-3">
        {!shown ? (
          <p className="flex items-center gap-2 text-xs text-admin-muted">
            <Search className="h-4 w-4" aria-hidden /> Search the ShowBuzz catalogue. Most films are already there.
          </p>
        ) : null}
        {searching ? (
          <p className="flex items-center gap-2 text-xs text-admin-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching…
          </p>
        ) : null}
        {error ? <p className="text-xs text-admin-danger">{error}</p> : null}
        {shown && shown.length === 0 && !searching ? (
          <p className="text-xs text-admin-muted">No film matches. Check the spelling, or create it below.</p>
        ) : null}
        {shown && shown.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {shown.map((hit) => (
              <li key={hit.id}>
                <Card className="flex gap-3 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue posters are arbitrary remote URLs */}
                  <img src={hit.poster} alt="" className="h-24 w-16 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/movies/${hit.id}`} className="font-bold text-admin-dark hover:text-admin-indigo">
                      {hit.title}
                    </Link>
                    <p className="text-[11px] text-admin-muted">
                      {hit.year} · {hit.languages.join(", ")} · {hit.certificate} ·{" "}
                      {formatDuration(hit.durationMinutes)}
                    </p>
                    <p className="text-[11px] text-admin-subtle">
                      {hit.status === "now-showing" ? "Now showing" : "Coming soon"}
                    </p>
                    <div className="mt-2">
                      {hit.added ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-admin-success">
                          <Check className="h-3.5 w-3.5" aria-hidden /> On your list
                        </span>
                      ) : (
                        <Button type="button" disabled={pending} onClick={() => add(hit)}>
                          {addingId === hit.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Plus className="h-4 w-4" aria-hidden />
                          )}
                          Add to my movies
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-admin-dark">Can&apos;t find the film?</p>
          <p className="text-[11px] text-admin-muted">
            Create it for the whole ShowBuzz catalogue. You&apos;ll be the only partner who can edit it.
          </p>
        </div>
        <Link
          href={createHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-admin-indigo bg-white px-4 py-2 text-xs font-bold text-admin-indigo hover:bg-admin-active"
        >
          <Plus className="h-4 w-4" aria-hidden /> Create new film
        </Link>
      </Card>
    </div>
  );
}
