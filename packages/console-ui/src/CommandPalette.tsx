"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import type { NavItem } from "@/lib/nav";
import { NAV_ICONS } from "./icons";

interface CommandPaletteProps {
  open: boolean;
  /** Pages the staff member can open (already permission-filtered). */
  pages: NavItem[];
  onClose: () => void;
}

/** Ctrl+K / ⌘K: jump to any console page. Records search comes later with the resource screens. */
export function CommandPalette({ open, pages, onClose }: CommandPaletteProps) {
  if (!open) return null;
  return <PaletteDialog pages={pages} onClose={onClose} />;
}

function PaletteDialog({ pages, onClose }: Omit<CommandPaletteProps, "open">) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? pages.filter((page) => page.label.toLowerCase().includes(q) || page.href.includes(q)) : pages;
  }, [pages, query]);

  function go(page: NavItem | undefined) {
    if (!page) return;
    onClose();
    router.push(page.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[selected]);
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search pages">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close search" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-admin-border bg-white shadow-modal">
        <div className="flex items-center gap-2 border-b border-admin-border px-4">
          <Search className="h-4 w-4 text-admin-subtle" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages…"
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            className="h-12 flex-1 bg-transparent text-sm text-admin-text outline-none placeholder:text-admin-subtle"
          />
          <kbd className="rounded border border-admin-border px-1.5 py-0.5 text-[10px] font-bold text-admin-muted">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-admin-muted">No pages match “{query}”.</li>
          ) : (
            results.map((page, index) => {
              const Icon = NAV_ICONS[page.icon];
              const active = index === selected;
              return (
                <li key={page.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => go(page)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-admin-dark",
                      active && "bg-admin-active text-admin-indigo",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1">{page.label}</span>
                    {active ? <CornerDownLeft className="h-3.5 w-3.5" aria-hidden /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
