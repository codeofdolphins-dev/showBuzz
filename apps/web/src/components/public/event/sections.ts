import type { SectionAccent } from "@/components/public/cards/ListingCard";

export type ListingSection = "play" | "sport" | "activity";

interface SectionConfig {
  path: string;
  crumb: string;
  titlePrefix: string;
  description: string;
  accent: SectionAccent;
  priceCaption: string;
  ctaLabel: string;
  wideImage: boolean;
  showLanguage: boolean;
  aboutHeading: string;
  tiersHeading: string;
  badgeSuffix: string;
}

export const LISTING_SECTIONS: Record<ListingSection, SectionConfig> = {
  play: {
    path: "/plays",
    crumb: "Plays & Theatre",
    titlePrefix: "Theatre Plays in",
    description: "Experience live stage drama, monologues, classics & musicals",
    accent: "amber",
    priceCaption: "From",
    ctaLabel: "Book Tickets",
    wideImage: false,
    showLanguage: true,
    aboutHeading: "Synopsis",
    tiersHeading: "Select Seating Tier",
    badgeSuffix: "",
  },
  sport: {
    path: "/sports",
    crumb: "Sports",
    titlePrefix: "Sports Matches & Tournaments in",
    description: "Experience the roar of Eden Gardens and stadium energy live!",
    accent: "emerald",
    priceCaption: "Stands from",
    ctaLabel: "Book Stadium Stand",
    wideImage: true,
    showLanguage: false,
    aboutHeading: "Match Briefing",
    tiersHeading: "Select Stadium Stand / Bay",
    badgeSuffix: " Match",
  },
  activity: {
    path: "/activities",
    crumb: "Activities",
    titlePrefix: "Fun Activities & Gaming in",
    description: "High-speed racing, VR escape rooms & theme parks",
    accent: "pink",
    priceCaption: "Slots from",
    ctaLabel: "Book Activity Slot",
    wideImage: true,
    showLanguage: false,
    aboutHeading: "Experience Highlights",
    tiersHeading: "Select Session Package",
    badgeSuffix: "",
  },
};
