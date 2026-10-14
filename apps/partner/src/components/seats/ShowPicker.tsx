"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card } from "@showbuzz/console-ui/PageParts";
import { Input, Select } from "@showbuzz/console-ui/form";
import type { ShowOption } from "@showbuzz/schemas/types/partner-venue";

interface ShowPickerProps {
  venues: { value: string; label: string }[];
  shows: ShowOption[];
  venueId: string;
  dateKey: string;
  showId: string;
}

/** Venue → IST date → show; every choice is a URL param, so the page reloads the live map on the server. */
export function ShowPicker({ venues, shows, venueId, dateKey, showId }: ShowPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <Card className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_12rem_2fr_auto] md:items-end">
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-admin-text">Venue</span>
        <Select value={venueId} onChange={(e) => set({ venue: e.target.value, show: "" })}>
          <option value="">All my venues</option>
          {venues.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-admin-text">Date (IST)</span>
        <Input type="date" value={dateKey} onChange={(e) => set({ date: e.target.value, show: "" })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-admin-text">Show</span>
        <Select value={showId} onChange={(e) => set({ show: e.target.value })} disabled={shows.length === 0}>
          <option value="">{shows.length === 0 ? "No seated shows on this date" : "Choose a show"}</option>
          {shows.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
      <span className="flex h-9 items-center">
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-admin-subtle" aria-label="Loading" /> : null}
      </span>
    </Card>
  );
}
