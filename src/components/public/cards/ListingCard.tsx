import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeSchedule } from "@/lib/schedule";
import type { EventListing } from "@/schemas/event";
import { tierPriceRange } from "./EventCard";

/** Accent palettes per section (plays are amber, sports emerald, activities pink). */
export const SECTION_ACCENTS = {
  amber: {
    badge: "bg-amber-500",
    text: "text-amber-600",
    hoverText: "group-hover:text-amber-600",
    button: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20",
    chip: "bg-amber-100 text-amber-800",
    selected: "border-amber-500 bg-amber-50/30",
    price: "text-amber-600",
  },
  emerald: {
    badge: "bg-emerald-600",
    text: "text-emerald-600",
    hoverText: "group-hover:text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20",
    chip: "bg-emerald-100 text-emerald-800",
    selected: "border-emerald-500 bg-emerald-50/30",
    price: "text-emerald-600",
  },
  pink: {
    badge: "bg-pink-600",
    text: "text-pink-600",
    hoverText: "group-hover:text-pink-600",
    button: "bg-pink-600 hover:bg-pink-700 shadow-pink-500/20",
    chip: "bg-pink-100 text-pink-800",
    selected: "border-pink-500 bg-pink-50/30",
    price: "text-pink-600",
  },
} as const;

export type SectionAccent = keyof typeof SECTION_ACCENTS;

interface ListingCardProps {
  listing: EventListing;
  href: string;
  accent: SectionAccent;
  priceCaption: string;
  ctaLabel: string;
  wideImage?: boolean;
  showLanguage?: boolean;
}

/** Card used by the plays, sports and activities listings. */
export function ListingCard({ listing, href, accent, priceCaption, ctaLabel, wideImage, showLanguage }: ListingCardProps) {
  const a = SECTION_ACCENTS[accent];
  const when = describeSchedule(listing.schedule);
  const DateIcon = listing.schedule.type === "daily" ? Clock : CalendarDays;

  return (
    <article className="premium-card group flex flex-col justify-between overflow-hidden rounded-3xl">
      <div>
        <div className={cn("relative overflow-hidden bg-slate-100", wideImage ? "aspect-[21/10]" : "aspect-[16/10]")}>
          <Image
            src={listing.poster}
            alt={listing.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span
            className={cn(
              "absolute top-3 left-3 rounded-md px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase",
              a.badge,
            )}
          >
            {listing.category}
          </span>
        </div>
        <div className="space-y-1.5 p-5">
          <span className={cn("flex items-center gap-1.5 text-xs font-bold", a.text)}>
            <DateIcon className="h-3 w-3" /> {when.date} &bull; {when.time}
          </span>
          <h3 className={cn("text-base font-black text-slate-900 transition-colors", a.hoverText)}>{listing.title}</h3>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" /> {listing.venueName}
            {showLanguage && listing.language && <> &bull; {listing.language}</>}
          </p>
          <p className="line-clamp-2 pt-1 text-xs leading-relaxed text-slate-600">{listing.about}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 p-5">
        <div>
          <span className="block text-[10px] text-slate-400">{priceCaption}</span>
          <span className="text-sm font-black text-slate-900">{tierPriceRange(listing)}</span>
        </div>
        <Link href={href} className={cn("rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md", a.button)}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
