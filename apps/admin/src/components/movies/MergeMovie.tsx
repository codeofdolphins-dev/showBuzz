"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Search } from "lucide-react";
import { Button, FormMessage, Input, Label } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { MovieMergePreview } from "@showbuzz/schemas/types/admin-marketplace";
import { mergeMoviesAction, previewMovieMergeAction, searchMergeTargetsAction } from "@/app/_actions/catalog";

/**
 * Merge a duplicate film into the one to keep: search the film to keep, see what moves, confirm. The duplicate is
 * archived and its public page redirects to the kept film.
 */
export function MergeMovie({ sourceId, sourceTitle }: { sourceId: string; sourceTitle: string }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [keep, setKeep] = useState<{ value: string; label: string } | null>(null);
  const [preview, setPreview] = useState<MovieMergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = await searchMergeTargetsAction(sourceId, value);
      setOptions(result.success ? result.data : []);
    }, 300);
  }

  function choose(option: { value: string; label: string }) {
    setKeep(option);
    setPreview(null);
    setError(null);
    startTransition(async () => {
      const result = await previewMovieMergeAction({ sourceId, keepId: option.value });
      if (result.success) setPreview(result.data);
      else setError(result.error.message);
    });
  }

  function merge() {
    if (!keep) return;
    setError(null);
    startTransition(async () => {
      const result = await mergeMoviesAction({ sourceId, keepId: keep.value });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success(`"${sourceTitle}" merged. /movies/${result.data.keepSlug} now has its shows.`);
      router.push(`/movies/${keep.value}`);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-admin-muted">
        Use this when two vendors created the same film. Pick the film to <b>keep</b>: this one&apos;s shows, vendor
        lists, reviews and wishlist saves move to it, and this film is archived (its page redirects).
      </p>
      <div className="relative">
        <Label htmlFor="merge-search">Film to keep</Label>
        <Search className="absolute top-8 left-3 h-4 w-4 text-admin-subtle" aria-hidden />
        <Input
          id="merge-search"
          type="search"
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by title…"
          className="pl-9"
          autoComplete="off"
        />
        {options.length > 0 && !keep ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-admin-border bg-white shadow-dropdown">
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => choose(o)}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-admin-active"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {keep ? (
        <div className="flex items-center justify-between rounded-lg border border-admin-border bg-slate-50 px-3 py-2 text-xs">
          <span>
            Keep: <b>{keep.label}</b>
          </span>
          <button
            type="button"
            className="font-bold text-admin-indigo hover:underline"
            onClick={() => {
              setKeep(null);
              setPreview(null);
            }}
          >
            Change
          </button>
        </div>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {preview ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-bold">
            Merge &ldquo;{preview.source.title}&rdquo; into &ldquo;{preview.keep.title}&rdquo;:
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>
              {preview.shows} show(s) move
              {preview.showsCancelled ? `; ${preview.showsCancelled} clashing demo show(s) are cancelled` : ""}
            </li>
            <li>{preview.vendorLinks} vendor list entry(ies) move</li>
            <li>
              {preview.reviews} review(s) move
              {preview.reviewsHidden ? `; ${preview.reviewsHidden} hidden (customer reviewed both)` : ""}
            </li>
            <li>
              {preview.wishlists} wishlist save(s) move; {preview.coupons} coupon scope(s) updated
            </li>
            <li>
              /movies/{preview.source.slug} redirects to /movies/{preview.keep.slug}
            </li>
          </ul>
          <p>This can&apos;t be undone.</p>
          <Button type="button" variant="danger" onClick={merge} disabled={pending}>
            <GitMerge className="h-4 w-4" aria-hidden />
            {pending ? "Merging…" : "Merge films"}
          </Button>
        </div>
      ) : keep && pending ? (
        <p className="text-xs text-admin-muted">Checking what would move…</p>
      ) : null}
    </div>
  );
}
