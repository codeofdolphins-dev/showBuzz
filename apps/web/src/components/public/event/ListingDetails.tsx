import Image from "next/image";
import { CalendarDays, Clock, MapPin, UserRound } from "lucide-react";
import { SECTION_ACCENTS } from "@/components/public/cards/ListingCard";
import { cn } from "@showbuzz/utils/cn";
import { describeSchedule } from "@showbuzz/utils/schedule";
import type { EventListing } from "@showbuzz/schemas/event";
import { LISTING_SECTIONS, type ListingSection } from "./sections";
import { LiveTierPicker } from "./LiveTierPicker";

/** Detail card for plays, sports and activities. */
interface ListingDetailsProps {
  listing: EventListing;
  section: ListingSection;
  /** Set for stadium matches, which continue to the seat map. */
  seatMapShowId?: string;
}

export function ListingDetails({ listing, section, seatMapShowId }: ListingDetailsProps) {
  const config = LISTING_SECTIONS[section];
  const a = SECTION_ACCENTS[config.accent];
  const when = describeSchedule(listing.schedule);
  const DateIcon = listing.schedule.type === "daily" ? Clock : CalendarDays;

  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      <div className="space-y-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <div
            className={cn(
              "relative w-full shrink-0 overflow-hidden rounded-2xl shadow-md",
              section === "play" ? "aspect-[3/4] md:w-72" : "aspect-[16/11] md:w-80",
            )}
          >
            <Image src={listing.poster} alt={listing.title} fill priority sizes="(min-width: 768px) 320px, 100vw" className="object-cover" />
          </div>
          <div className="flex-1 space-y-3">
            <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold uppercase", a.chip)}>
              {listing.category}
              {config.badgeSuffix}
            </span>
            <h1 className="text-2xl leading-tight font-black text-slate-900 sm:text-3xl">{listing.title}</h1>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <DateIcon className={cn("h-3.5 w-3.5", a.text)} /> {when.date} &bull; {when.time}
              {listing.durationLabel && <> &bull; {listing.durationLabel}</>}
            </p>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <MapPin className={cn("h-3.5 w-3.5", a.text)} /> {listing.venueName}
              {listing.language && <> &bull; Language: {listing.language}</>}
            </p>
            {listing.organiserName && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <UserRound className={cn("h-3.5 w-3.5", a.text)} /> Organised by {listing.organiserName}
              </p>
            )}
            {listing.director && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <UserRound className={cn("h-3.5 w-3.5", a.text)} /> Directed by: {listing.director}
              </p>
            )}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="mb-1 text-sm font-bold text-slate-900">{config.aboutHeading}</h4>
              <p className="text-xs leading-relaxed text-slate-600">{listing.about}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="mb-4 text-base font-extrabold text-slate-900">{config.tiersHeading}</h3>
          <LiveTierPicker
            listing={listing}
            accent={config.accent}
            layout="grid"
            seatMapShowId={seatMapShowId}
          />
        </div>
      </div>
    </main>
  );
}
