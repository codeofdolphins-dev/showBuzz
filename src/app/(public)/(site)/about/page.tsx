import type { Metadata } from "next";
import Image from "next/image";
import { Handshake, WandSparkles, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Our mission: India's smoothest entertainment ticketing platform.",
};

const VALUES = [
  { icon: WandSparkles, tone: "bg-rose-50 text-rose-600", title: "Delightful Experience", text: "We design interfaces that feel fast, intuitive, and enjoyable from the moment you explore a trailer to the second you scan your ticket." },
  { icon: Zap, tone: "bg-blue-50 text-blue-600", title: "Unmatched Speed", text: "Infrastructure built to handle massive ticket demand during stadium cricket finals and viral concert drops." },
  { icon: Handshake, tone: "bg-emerald-50 text-emerald-600", title: "Empowering Organisers", text: "Giving independent artists, playwrights, comedians, and cinema exhibitors world-class discovery, promotion, and analytics tools." },
];

export default function AboutPage() {
  return (
    <main className="w-full flex-1 space-y-12 px-4 py-12 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <span className="text-xs font-black tracking-widest text-rose-600 uppercase">Our Mission</span>
        <h1 className="text-3xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl">
          Bringing Stories, Music & Experiences to Life
        </h1>
        <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
          ShowBuzz was founded with a singular ambition: to build India&apos;s smoothest, most visually inspiring entertainment
          ticketing platform.
        </p>
      </div>
      <div className="relative aspect-[21/9] overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
        <Image
          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80"
          alt="Concert arena"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {VALUES.map((v) => (
          <div key={v.title} className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${v.tone}`}>
              <v.icon className="h-6 w-6" />
            </span>
            <h3 className="text-base font-black text-slate-900">{v.title}</h3>
            <p className="text-xs leading-relaxed text-slate-500">{v.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
