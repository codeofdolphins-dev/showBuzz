import type { ShowAvailability } from "../venue";

export type SearchEntryType = "movie" | "event" | "play" | "sport" | "activity" | "cinema";

/** Lightweight record the header search filters on the client. */
export interface SearchEntry {
  type: SearchEntryType;
  title: string;
  subtitle: string;
  keywords: string;
  href: string;
  image?: string;
}

export interface Show {
  id: string;
  movieId: string;
  cinemaId: string;
  startsAt: string;
  format: string;
  language: string;
  availability: ShowAvailability;
  pricePaise: number;
  priceTier: string;
  screenName: string;
}

/** What the seat page and the order quote need to know about a bookable show. */
export interface ShowDetails {
  id: string;
  kind: "movie" | "sport";
  title: string;
  poster: string;
  certificate?: string;
  category?: string;
  format?: string;
  language?: string;
  venueName: string;
  venueAddress?: string;
  screenName: string;
  startsAt: string;
  cancellationAllowed: boolean;
  backHref: string;
}

export type SeatStatus = "available" | "sold" | "accessible";

export interface Seat {
  id: string;
  number: number;
  status: SeatStatus;
}

export interface SeatRow {
  row: string;
  seats: Seat[];
  /** Seat number after which an aisle gap is drawn. */
  aisleAfter?: number;
}

export interface SeatTier {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  accent: "rose" | "amber" | "blue";
  recliner: boolean;
  rows: SeatRow[];
}

export interface SeatMap {
  layout: "screen" | "stadium";
  tiers: SeatTier[];
}
