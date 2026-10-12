"use client";

import Image from "next/image";
import Link from "next/link";
import { Music, Play, Ticket, Trophy, Zap, type LucideIcon } from "lucide-react";
import { Autoplay, EffectFade, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { TrailerButton } from "@/components/public/common/TrailerButton";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/cn";

export interface HeroSlide {
  id: string;
  image: string;
  badge: string;
  badgeIcon: "zap" | "music" | "trophy";
  tone: "rose" | "purple" | "emerald";
  title: string;
  blurb: string;
  ctaLabel: string;
  ctaHref: string;
  trailer?: { title: string; url: string };
}

const ICONS: Record<HeroSlide["badgeIcon"], LucideIcon> = { zap: Zap, music: Music, trophy: Trophy };

const TONES: Record<HeroSlide["tone"], { badge: string; cta: string }> = {
  rose: { badge: "bg-rose-500/25 text-rose-300 border-rose-500/40", cta: "gradient-btn" },
  purple: {
    badge: "bg-purple-500/30 text-purple-200 border-purple-400/40",
    cta: "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700",
  },
  emerald: {
    badge: "bg-emerald-500/30 text-emerald-200 border-emerald-400/40",
    cta: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700",
  },
};

function SlideContent({ slide, priority }: { slide: HeroSlide; priority: boolean }) {
  const Icon = ICONS[slide.badgeIcon];
  const tone = TONES[slide.tone];
  return (
    <>
      <Image
        src={slide.image}
        alt={slide.title}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover object-right opacity-85 sm:object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 via-45% to-slate-950/10" />
      <div className="relative z-10 max-w-2xl p-5 sm:p-9 md:p-10 lg:p-12">
        <span
          className={cn(
            "mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] font-extrabold tracking-wider uppercase sm:text-xs",
            tone.badge,
          )}
        >
          <Icon className="h-3 w-3" /> {slide.badge}
        </span>
        <h2 className="text-xl leading-tight font-black tracking-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl">
          {slide.title}
        </h2>
        <p className="mt-1 hidden text-xs leading-relaxed text-slate-200 drop-shadow-sm sm:mt-2 sm:line-clamp-2 sm:text-sm">
          {slide.blurb}
        </p>
        <div className="mt-3 flex items-center gap-2.5 sm:mt-5">
          <Link
            href={slide.ctaHref}
            className={cn(
              "tap-active flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold text-white shadow-lg sm:px-6 sm:py-2.5 sm:text-sm",
              tone.cta,
            )}
          >
            <Ticket className="h-3.5 w-3.5" /> {slide.ctaLabel}
          </Link>
          {slide.trailer && (
            <TrailerButton
              title={slide.trailer.title}
              url={slide.trailer.url}
              className="tap-active flex items-center gap-1.5 rounded-xl border border-white/30 bg-black/30 px-4 py-2 text-xs font-bold text-white backdrop-blur-md hover:bg-black/50 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <Play className="h-3.5 w-3.5" /> Trailer
            </TrailerButton>
          )}
        </div>
      </div>
    </>
  );
}

const FRAME =
  "h-[230px] overflow-hidden rounded-2xl border border-slate-200/60 shadow-xl sm:h-[280px] sm:rounded-3xl md:h-[320px] lg:h-[350px]";
const SLIDE = "relative flex! items-center overflow-hidden bg-slate-950 text-white";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  // Swiper reads the clock while rendering, so it only mounts in the browser; the server
  // renders the first slide as a static frame of the same size.
  const mounted = useMounted();
  const first = slides[0];
  if (!mounted) {
    return first ? (
      <div className={cn(FRAME, SLIDE.replace("flex!", "flex"))}>
        <SlideContent slide={first} priority />
      </div>
    ) : null;
  }

  return (
    <Swiper
      modules={[Autoplay, EffectFade, Navigation, Pagination]}
      loop
      effect="fade"
      fadeEffect={{ crossFade: true }}
      autoplay={{ delay: 4500, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      navigation
      className={cn(
        FRAME,
        "[&_.swiper-button-next]:hidden [&_.swiper-button-prev]:hidden sm:[&_.swiper-button-next]:flex sm:[&_.swiper-button-prev]:flex",
      )}
    >
      {slides.map((slide, i) => (
        <SwiperSlide key={slide.id} className={SLIDE}>
          <SlideContent slide={slide} priority={i === 0} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
