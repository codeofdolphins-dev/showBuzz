"use client";

import Image from "next/image";
import Link from "next/link";
import { Building, Search } from "lucide-react";
import type { SearchEntry, SearchEntryType } from "@showbuzz/schemas/types/catalog";

const GROUPS: { label: string; types: SearchEntryType[]; cta: string }[] = [
  { label: "Movies", types: ["movie"], cta: "Book" },
  { label: "Events, Plays & Sports", types: ["event", "play", "sport", "activity"], cta: "Passes" },
  { label: "Cinemas", types: ["cinema"], cta: "Showtimes" },
];

interface SearchResultsProps {
  query: string;
  results: SearchEntry[];
  /** A newer query is still being searched on the server. */
  loading?: boolean;
  onNavigate: () => void;
}

export function SearchResults({ query, results, loading = false, onNavigate }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="p-6 text-center" aria-live="polite">
        <Search className="mx-auto mb-2 h-6 w-6 text-slate-300" />
        <p className="text-xs font-bold text-slate-800">
          {loading ? "Searching…" : <>No matches for &ldquo;{query}&rdquo;</>}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      <div className="flex items-center justify-between bg-slate-50 p-2.5 text-[11px] font-bold text-slate-500">
        Found {results.length} matching results
      </div>
      {GROUPS.map((group) => {
        const items = results.filter((r) => group.types.includes(r.type));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="p-2">
            <p className="px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">
              {group.label}
            </p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="group tap-active flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    width={36}
                    height={48}
                    className="h-12 w-9 rounded-lg object-cover shadow-sm"
                  />
                ) : (
                  <span className="flex h-12 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                    <Building className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-900 group-hover:text-rose-600">
                    {item.title}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{item.subtitle}</span>
                </span>
                <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                  {group.cta}
                </span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
