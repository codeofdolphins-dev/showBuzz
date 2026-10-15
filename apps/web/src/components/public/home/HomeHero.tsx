"use client";

import { useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useCityStore } from "@/stores/city";
import type { PublicBanner } from "@showbuzz/schemas/banner";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";

function toSlide(banner: PublicBanner): HeroSlide {
  return {
    id: banner.id,
    image: banner.imageUrl,
    badge: banner.badge,
    badgeIcon: banner.icon,
    tone: banner.tone,
    title: banner.title,
    blurb: banner.blurb,
    ctaLabel: banner.ctaLabel,
    ctaHref: banner.linkUrl,
  };
}

function isLive(banner: PublicBanner, cityId: string, now: number): boolean {
  if (banner.cityId && banner.cityId !== cityId) return false;
  if (banner.startsAt && Date.parse(banner.startsAt) > now) return false;
  return !(banner.endsAt && Date.parse(banner.endsAt) <= now);
}

/**
 * The home hero: the super-admin's banners (prompt 7) for the visitor's city and the current time, else the built-in
 * slides. The page stays cached: dates and city are checked here, in the browser. Before mount (server HTML) it
 * shows the first banner meant for every city with no dates, or the first built-in slide.
 */
export function HomeHero({ banners, fallback }: { banners: PublicBanner[]; fallback: HeroSlide[] }) {
  const mounted = useMounted();
  const cityId = useCityStore((s) => s.city.id);
  // Read once per page view, in the browser only (prerendering must not read the clock).
  const [now] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  if (!mounted) {
    const timeless = banners.find((b) => !b.cityId && !b.startsAt && !b.endsAt);
    return <HeroCarousel slides={timeless ? [toSlide(timeless)] : fallback.slice(0, 1)} />;
  }
  const live = banners.filter((b) => isLive(b, cityId, now)).map(toSlide);
  return <HeroCarousel key={live.map((s) => s.id).join(",") || "fallback"} slides={live.length > 0 ? live : fallback} />;
}
