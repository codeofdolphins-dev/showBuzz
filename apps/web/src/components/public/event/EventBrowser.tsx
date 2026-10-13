"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { EventCard } from "@/components/public/cards/EventCard";
import { CityName } from "@/components/public/common/CityName";
import { EmptyState } from "@/components/public/common/EmptyState";
import { PageHeader } from "@/components/public/common/PageHeader";
import { cn } from "@showbuzz/utils/cn";
import type { EventListing } from "@showbuzz/schemas/event";

const CATEGORIES = [
  { value: "all", label: "All Events" },
  { value: "Music Concert", label: "Concerts" },
  { value: "Standup Comedy", label: "Comedy" },
  { value: "Magic & Illusion", label: "Magic" },
  { value: "Food & Drinks", label: "Food Fest" },
];

export function EventBrowser({ events }: { events: EventListing[] }) {
  const [category, setCategory] = useState("all");
  const visible = category === "all" ? events : events.filter((e) => e.category === category);

  return (
    <>
      <PageHeader
        crumb="Live Events"
        title={
          <>
            Events & Shows in <CityName className="text-rose-600" />
          </>
        }
        description="Explore music concerts, standup comedy, magic spectaculars & festivals"
        actions={
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Event category">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="tab"
                aria-selected={category === c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-bold",
                  category === c.value ? "bg-rose-500 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        }
      />
      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={CalendarDays} title="No events in this category" description="Check back soon or explore other categories." />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((e) => (
            <EventCard key={e.id} event={e} href={`/events/${e.slug}`} />
          ))}
        </div>
      )}
    </>
  );
}
