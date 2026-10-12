import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { WishlistButton } from "@/components/public/common/WishlistButton";
import { formatPriceRange } from "@/lib/money";
import { describeSchedule } from "@/lib/schedule";
import type { EventListing } from "@/schemas/event";

export function tierPriceRange(event: EventListing) {
  const prices = event.ticketTiers.map((t) => t.pricePaise);
  return formatPriceRange(Math.min(...prices), Math.max(...prices));
}

/** Card for concerts and other live events (home page and /events). */
export function EventCard({ event, href }: { event: EventListing; href: string }) {
  const when = describeSchedule(event.schedule);
  return (
    <article className="premium-card group relative flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <Image
          src={event.poster}
          alt={event.title}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <WishlistButton
          id={event.id}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 text-slate-700 shadow-md backdrop-blur-md hover:text-rose-600"
          iconClassName="h-4 w-4"
        />
        <span className="absolute top-3 left-3 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
          {event.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
            <CalendarDays className="h-3 w-3" /> {when.date}
          </span>
          <h4
            className="mt-1 line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-rose-600"
            title={event.title}
          >
            {event.title}
          </h4>
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-medium text-slate-500">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" /> {event.venueName}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <span className="block text-[10px] text-slate-400">Starting from</span>
            <span className="text-sm font-black text-slate-900">{tierPriceRange(event)}</span>
          </div>
          <Link
            href={href}
            className="gradient-btn rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20"
          >
            Book Now
          </Link>
        </div>
      </div>
    </article>
  );
}
