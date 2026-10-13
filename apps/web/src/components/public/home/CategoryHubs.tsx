import Link from "next/link";
import { Building, CalendarDays, Dices, Drama, Film, Gift, MicVocal, Play, Tags, Trophy } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";

const CATEGORIES = [
  { href: "/movies", label: "Movies", icon: Film, tone: "rose" },
  { href: "/stream", label: "Stream", icon: Play, tone: "indigo", badge: "NEW" },
  { href: "/events", label: "Events", desktopLabel: "Live Events", icon: CalendarDays, tone: "purple" },
  { href: "/plays", label: "Plays", desktopLabel: "Plays & Theatre", icon: Drama, tone: "amber" },
  { href: "/sports", label: "Sports", icon: Trophy, tone: "emerald" },
  { href: "/activities", label: "Activities", icon: Dices, tone: "pink" },
  { href: "/cinemas", label: "Cinemas", icon: Building, tone: "blue" },
] as const;

const TONES = {
  rose: { tile: "bg-rose-50 text-rose-600 border-rose-100", pill: "hover:bg-rose-50/90 hover:border-rose-200/90 hover:text-rose-600", icon: "bg-rose-100 text-rose-600 group-hover:bg-rose-500" },
  indigo: { tile: "bg-indigo-50 text-indigo-600 border-indigo-100", pill: "hover:bg-indigo-50/90 hover:border-indigo-200/90 hover:text-indigo-600", icon: "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-500" },
  purple: { tile: "bg-purple-50 text-purple-600 border-purple-100", pill: "hover:bg-purple-50/90 hover:border-purple-200/90 hover:text-purple-600", icon: "bg-purple-100 text-purple-600 group-hover:bg-purple-500" },
  amber: { tile: "bg-amber-50 text-amber-600 border-amber-100", pill: "hover:bg-amber-50/90 hover:border-amber-200/90 hover:text-amber-600", icon: "bg-amber-100 text-amber-600 group-hover:bg-amber-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-600 border-emerald-100", pill: "hover:bg-emerald-50/90 hover:border-emerald-200/90 hover:text-emerald-600", icon: "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500" },
  pink: { tile: "bg-pink-50 text-pink-600 border-pink-100", pill: "hover:bg-pink-50/90 hover:border-pink-200/90 hover:text-pink-600", icon: "bg-pink-100 text-pink-600 group-hover:bg-pink-500" },
  blue: { tile: "bg-blue-50 text-blue-600 border-blue-100", pill: "hover:bg-blue-50/90 hover:border-blue-200/90 hover:text-blue-600", icon: "bg-blue-100 text-blue-600 group-hover:bg-blue-500" },
} as const;

/** Mobile icon grid (app style) and the desktop category ribbon on the home page. */
export function CategoryHubs() {
  return (
    <>
      <section className="border-b border-slate-200/70 bg-white px-4 pt-4 pb-3 lg:hidden">
        <div className="grid grid-cols-4 gap-x-2 gap-y-3 text-center">
          {CATEGORIES.map((c) => (
            <Link key={c.href} href={c.href} className="tap-active flex flex-col items-center">
              <span
                className={cn(
                  "relative mb-1.5 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm",
                  TONES[c.tone].tile,
                )}
              >
                <c.icon className="h-5 w-5" />
                {"badge" in c && (
                  <span className="absolute -top-1 -right-1 rounded-full bg-indigo-600 px-1 text-[8px] font-black text-white">
                    {c.badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-bold text-slate-800">{c.label}</span>
            </Link>
          ))}
          <Link href="/offers" className="tap-active flex flex-col items-center">
            <span className={cn("mb-1.5 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm", TONES.rose.tile)}>
              <Tags className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-bold text-slate-800">Offers</span>
          </Link>
        </div>
      </section>

      <div className="hidden border-b border-slate-200/80 bg-white/95 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-md lg:block">
        <div className="flex w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5 xl:gap-2.5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  "group tap-active flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm",
                  TONES[c.tone].pill,
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-all group-hover:text-white",
                    TONES[c.tone].icon,
                  )}
                >
                  <c.icon className="h-3 w-3" />
                </span>
                <span>{"desktopLabel" in c ? c.desktopLabel : c.label}</span>
                {"badge" in c && (
                  <span className="rounded-full bg-indigo-600 px-1.5 text-[8px] font-black tracking-wider text-white uppercase">
                    {c.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 xl:gap-3">
            <Link
              href="/list-your-show"
              className="tap-active hidden items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 xl:flex"
            >
              <MicVocal className="h-3.5 w-3.5 text-slate-400" /> List Your Show
            </Link>
            <Link
              href="/gift-cards"
              className="tap-active hidden items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 xl:flex"
            >
              <Gift className="h-3.5 w-3.5 text-purple-500" /> Gift Cards
            </Link>
            <Link
              href="/offers"
              className="tap-active flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-purple-600 px-3.5 py-1.5 text-xs font-black whitespace-nowrap text-white shadow-sm shadow-rose-500/25 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Tags className="h-3 w-3" /> Top Offers
              <span className="rounded-md bg-white/25 px-1.5 text-[9px] font-extrabold">50% OFF</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
