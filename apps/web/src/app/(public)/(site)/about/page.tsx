import type { Metadata } from "next";
import Image from "next/image";
import { Handshake, Sparkles, Star, WandSparkles, Zap, type LucideIcon } from "lucide-react";
import { getSitePage, withSeoOverride } from "@showbuzz/core/services/site-content.service";

/** SEO overrides from the admin console apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/about", {
    title: "About Us",
    description: "Our mission: India's smoothest entertainment ticketing platform.",
  });
}

/** Card icons and colours by position (the cards' text is edited in the admin console). */
const CARD_LOOKS: { icon: LucideIcon; tone: string }[] = [
  { icon: WandSparkles, tone: "bg-rose-50 text-rose-600" },
  { icon: Zap, tone: "bg-blue-50 text-blue-600" },
  { icon: Handshake, tone: "bg-emerald-50 text-emerald-600" },
  { icon: Sparkles, tone: "bg-purple-50 text-purple-600" },
  { icon: Star, tone: "bg-amber-50 text-amber-600" },
];

export default async function AboutPage() {
  const { content } = await getSitePage("about");
  return (
    <main className="w-full flex-1 space-y-12 px-4 py-12 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        {content.eyebrow ? (
          <span className="text-xs font-black tracking-widest text-rose-600 uppercase">{content.eyebrow}</span>
        ) : null}
        <h1 className="text-3xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl">{content.title}</h1>
        {content.intro ? <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">{content.intro}</p> : null}
      </div>
      <div className="relative aspect-[21/9] overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
        <Image src={content.imageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {content.cards.map((card, i) => {
          const look = CARD_LOOKS[i % CARD_LOOKS.length]!;
          return (
            <div
              key={`${i}-${card.title}`}
              className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${look.tone}`}>
                <look.icon className="h-6 w-6" />
              </span>
              <h3 className="text-base font-black text-slate-900">{card.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">{card.text}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
