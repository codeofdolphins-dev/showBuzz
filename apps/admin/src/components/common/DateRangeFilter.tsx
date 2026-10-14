"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** `?from=&to=` (IST dates) next to a FilterBar; changing either goes back to page 1. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function set(name: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    const next = params.toString();
    startTransition(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  const input =
    "rounded-md border border-admin-border bg-white px-2 py-1.5 text-base text-admin-text focus:border-admin-indigo focus:outline-none sm:text-xs";
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-admin-muted">
      <label className="flex items-center gap-1.5">
        From
        <input
          type="date"
          className={input}
          value={searchParams.get("from") ?? ""}
          onChange={(e) => set("from", e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1.5">
        To
        <input
          type="date"
          className={input}
          value={searchParams.get("to") ?? ""}
          onChange={(e) => set("to", e.target.value)}
        />
      </label>
    </div>
  );
}
