"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";

/**
 * Search box + select filters above a DataTable. Every change rewrites the URL search params (and goes back to page
 * 1), so the server re-renders the list; the browser history keeps each filter step.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  /** Search param name, e.g. "status". */
  name: string;
  label: string;
  options: FilterOption[];
  /** Label of the "no filter" choice; defaults to "All". */
  allLabel?: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  /** Omit to hide the search box. */
  searchParam?: string | null;
  filters?: FilterDefinition[];
  /** Extra controls on the right (e.g. "Add venue"). */
  actions?: ReactNode;
}

const SEARCH_DELAY_MS = 350;

export function FilterBar({ searchPlaceholder = "Search…", searchParam = "q", filters = [], actions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const currentQuery = searchParam ? (searchParams.get(searchParam) ?? "") : "";
  const [query, setQuery] = useState(currentQuery);
  const [syncedQuery, setSyncedQuery] = useState(currentQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Back/forward navigation changes the URL: show its query in the box.
  if (currentQuery !== syncedQuery) {
    setSyncedQuery(currentQuery);
    setQuery(currentQuery);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const next = params.toString();
    startTransition(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  function onSearch(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (!searchParam) return;
    timer.current = setTimeout(() => update({ [searchParam]: value.trim() }), SEARCH_DELAY_MS);
  }

  const hasFilters = (searchParam && currentQuery) || filters.some((f) => searchParams.get(f.name));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-admin-border bg-white p-3 shadow-card lg:flex-row lg:items-center">
      {searchParam ? (
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-admin-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-md border border-admin-border bg-slate-50 py-2 pr-8 pl-9 text-base text-admin-text placeholder:text-admin-subtle focus:border-admin-indigo focus:bg-white focus:ring-3 focus:ring-admin-indigo/15 focus:outline-none sm:text-xs"
          />
          {pending ? (
            <Loader2 className="absolute top-2.5 right-3 h-4 w-4 animate-spin text-admin-subtle" aria-hidden />
          ) : null}
        </div>
      ) : null}
      <div className={cn("flex flex-wrap items-center gap-2", !searchParam && "flex-1")}>
        {filters.map((filter) => (
          <label key={filter.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-admin-muted">
            <span>{filter.label}</span>
            <select
              value={searchParams.get(filter.name) ?? ""}
              onChange={(event) => update({ [filter.name]: event.target.value })}
              className="rounded-md border border-admin-border bg-white px-2 py-1.5 text-base text-admin-text focus:border-admin-indigo focus:outline-none sm:text-xs"
            >
              <option value="">{filter.allLabel ?? "All"}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              update(
                Object.fromEntries(
                  [searchParam ?? "", ...filters.map((f) => f.name)].filter(Boolean).map((k) => [k, ""]),
                ),
              );
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold text-admin-muted hover:bg-slate-100 hover:text-admin-dark"
          >
            <X className="h-3 w-3" aria-hidden /> Clear
          </button>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
