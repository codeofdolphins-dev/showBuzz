import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Navigation, Ticket, UserRound } from "lucide-react";
import { tierPriceRange } from "@/components/public/cards/EventCard";
import { WishlistButton } from "@/components/public/common/WishlistButton";
import { LiveTierPicker } from "@/components/public/event/LiveTierPicker";
import { slugParams } from "@/lib/static-params";
import { describeSchedule } from "@showbuzz/utils/schedule";
import { getEventBySlug, listEvents } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

export async function generateStaticParams() {
  return slugParams((await listEvents("event")).map((e) => e.slug));
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const event = await getEventBySlug("event", (await params).slug);
  if (!event) return { title: "Event not found" };
  return withSeoOverride(`/events/${event.slug}`, { title: `${event.title} - Book Passes`, description: event.about });
}

export default async function EventDetailsPage({ params }: PageProps<"/events/[slug]">) {
  const event = await getEventBySlug("event", (await params).slug);
  if (!event) notFound();
  const when = describeSchedule(event.schedule);

  return (
    <main className="flex-1 pb-16">
      <section className="relative flex min-h-[380px] items-center overflow-hidden bg-slate-950 text-white sm:min-h-[440px]">
        <Image
          src={event.backdrop ?? event.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30 mix-blend-luminosity blur-xs"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        <div className="relative z-10 w-full px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
            <div className="relative aspect-[16/11] w-48 shrink-0 overflow-hidden rounded-2xl border-2 border-white/10 shadow-2xl sm:w-60">
              <Image src={event.poster} alt={event.title} fill priority sizes="240px" className="object-cover" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-extrabold tracking-wider text-white uppercase">
                  {event.category}
                </span>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                  {event.ageLimit ?? "All Ages"}
                </span>
                {event.durationLabel && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                    <Clock className="h-3 w-3" /> {event.durationLabel}
                  </span>
                )}
              </div>
              <h1 className="text-2xl leading-tight font-black tracking-tight text-white sm:text-4xl">{event.title}</h1>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-300 sm:text-sm">
                <CalendarDays className="h-3.5 w-3.5 text-rose-400" /> {when.date} &bull; {when.time}
              </p>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-300 sm:text-sm">
                <MapPin className="h-3.5 w-3.5 text-rose-400" /> {event.venueName}
              </p>
              {event.organiserName && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-300 sm:text-sm">
                  <UserRound className="h-3.5 w-3.5 text-rose-400" /> Organised by {event.organiserName}
                </p>
              )}
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="#ticket-tiers"
                  className="flex gradient-btn items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/30 transition-transform hover:scale-105"
                >
                  <Ticket className="h-4 w-4" /> Select Passes from {tierPriceRange(event).split(" - ")[0]}
                </a>
                <WishlistButton
                  id={event.id}
                  className="h-12 w-12 rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  activeClassName="text-rose-500"
                  iconClassName="h-5 w-5"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-8 lg:col-span-2 xl:col-span-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
              <h3 className="mb-3 text-lg font-extrabold text-slate-900">About the Event</h3>
              <p className="text-sm leading-relaxed text-slate-600">{event.about}</p>
            </div>

            {event.artists.length > 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
                <h3 className="mb-4 text-lg font-extrabold text-slate-900">Artist Lineup</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {event.artists.map((a) => (
                    <div key={a.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                      <Image
                        src={a.image}
                        alt={a.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                      />
                      <div className="min-w-0">
                        <h5 className="truncate text-xs font-bold text-slate-900">{a.name}</h5>
                        <p className="truncate text-[11px] text-slate-400">{a.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
              <h3 className="mb-2 text-lg font-extrabold text-slate-900">Venue & Location</h3>
              <p className="mb-4 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3 text-rose-500" /> {event.venueName}
              </p>
              <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <Image
                  src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&auto=format&fit=crop&q=80"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover opacity-60"
                />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.venueName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-lg hover:bg-slate-50"
                >
                  <Navigation className="h-3.5 w-3.5 text-rose-500" /> Open in Google Maps
                </a>
              </div>
            </div>
          </div>

          <div id="ticket-tiers" className="scroll-mt-24 lg:col-span-1">
            <div className="sticky top-24 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-7">
              <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-extrabold text-slate-900">
                Select Ticket Passes
              </h3>
              <LiveTierPicker listing={event} accent="rose" layout="stack" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
