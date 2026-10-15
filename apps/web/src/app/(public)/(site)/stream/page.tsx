import type { Metadata } from "next";
import Image from "next/image";
import { CirclePlay, Play, Star } from "lucide-react";
import { StreamActionButton } from "@/components/public/stream/StreamActions";
import { formatDuration } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { listStreamTitles } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

const META: Metadata = {
  title: "Stream Premieres",
  description: "Rent or buy new releases, documentaries and concerts in 4K HDR.",
};

/** SEO overrides from the admin console (prompt 7) apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/stream", META);
}

export default async function StreamPage() {
  const titles = await listStreamTitles();
  const featured = titles.find((t) => t.featured) ?? titles[0];

  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      {featured && (
        <div className="relative mb-12 flex flex-col items-center justify-between gap-8 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 shadow-2xl sm:p-12 md:flex-row">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/20 px-3 py-1 text-[10px] font-extrabold tracking-wider text-rose-300 uppercase">
              <Play className="h-3 w-3" /> {featured.badge}
            </span>
            <h1 className="text-3xl leading-tight font-black tracking-tight text-white sm:text-5xl">
              {featured.title}
            </h1>
            <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{featured.description}</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <StreamActionButton
                label="Renting"
                className="flex tap-active gradient-btn items-center gap-2 rounded-2xl px-6 py-3 text-xs font-black text-white shadow-xl shadow-rose-500/30"
              >
                <CirclePlay className="h-4 w-4" /> Rent for {formatINR(featured.rentPricePaise)} (30 Days)
              </StreamActionButton>
              <StreamActionButton
                label="Buying"
                className="tap-active rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-xs font-bold text-white hover:bg-white/20"
              >
                Buy for {formatINR(featured.buyPricePaise)}
              </StreamActionButton>
            </div>
          </div>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl md:w-96">
            <Image
              src={featured.poster}
              alt={featured.title}
              fill
              priority
              sizes="(min-width: 768px) 384px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900">Latest Premieres on Demand</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Rent to watch anytime within 30 days, or purchase lifetime digital access.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {titles.map((s) => (
          <article
            key={s.id}
            className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-rose-300 hover:shadow-md"
          >
            <div>
              <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl">
                <Image
                  src={s.poster}
                  alt={s.title}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute top-3 left-3 rounded-md bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase">
                  {s.badge}
                </span>
              </div>
              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
                  {s.category} &bull; {formatDuration(s.durationMinutes)} &bull;
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.rating}
                </span>
                <h3 className="text-base font-black text-slate-900">{s.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{s.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <span className="block text-[10px] font-medium text-slate-400">Rent from</span>
                <span className="text-sm font-black text-slate-900">{formatINR(s.rentPricePaise)}</span>
              </div>
              <div className="flex gap-2">
                <StreamActionButton
                  label="Renting"
                  className="tap-active rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Rent
                </StreamActionButton>
                <StreamActionButton
                  label="Buying"
                  className="tap-active gradient-btn rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md"
                >
                  Buy {formatINR(s.buyPricePaise)}
                </StreamActionButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
