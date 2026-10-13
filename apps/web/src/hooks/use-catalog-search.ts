"use client";

import { useEffect, useState } from "react";
import type { SearchEntry } from "@showbuzz/schemas/types/catalog";
import { searchCatalogAction } from "@/app/(public)/_actions/search";

const DEBOUNCE_MS = 200;

/** Debounced header search. Only the latest query's answer is kept, so slow responses can't overwrite newer ones. */
export function useCatalogSearch(query: string): { results: SearchEntry[]; loading: boolean } {
  const q = query.trim();
  const [settled, setSettled] = useState<{ query: string; results: SearchEntry[] }>({ query: "", results: [] });

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchCatalogAction(q);
      if (!cancelled) setSettled({ query: q, results: result.success ? result.data : [] });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  if (!q) return { results: [], loading: false };
  // While a newer query is in flight, the previous results stay on screen instead of flashing "no matches".
  return { results: settled.results, loading: settled.query !== q };
}
