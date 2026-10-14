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
  /** The selling vendor (its rates price the order) and the venue (its food menu). */
  vendorId: string;
  venueId: string;
  /** The vendor's business name, shown as "by …" / "Organised by …". */
  operatorName?: string;
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
  /** Venue and vendor policy both allow cancelling (the cutoff and fee are the vendor's). */
  cancellationAllowed: boolean;
  backHref: string;
}

/** "sold" covers seats sold and seats held by other customers: both are unavailable to this browser. */
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
  /** Seats this browser already holds for the show (pre-selected), with the hold's real expiry. */
  ownHold?: { seatIds: string[]; expiresAt: string };
}
