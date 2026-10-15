import type { EventKind } from "../event";
import type { Movie, MovieStatus } from "../movie";
import type { EventInput, ListingStatus, MovieInput } from "../partner-listing";

/** Partner portal views of movies, listings and shows (what the services return to the pages). */

export interface VendorMovieRow {
  id: string;
  slug: string;
  title: string;
  poster: string;
  genres: string[];
  languages: string[];
  formats: string[];
  certificate: string;
  durationMinutes: number;
  releaseDate: string;
  rating: number;
  status: MovieStatus;
  /** Created by this vendor (it may edit it); otherwise the shared catalogue, read-only. */
  own: boolean;
  upcomingShows: number;
}

/** A catalogue search hit on "Add movie". */
export interface MovieSearchHit {
  id: string;
  title: string;
  poster: string;
  languages: string[];
  year: string;
  certificate: string;
  durationMinutes: number;
  status: MovieStatus;
  /** Already on this vendor's list. */
  added: boolean;
}

export interface VendorMovieDetail {
  movie: Movie;
  own: boolean;
  /** On this vendor's list (scheduling allowed). */
  added: boolean;
  /** Who added it to the catalogue ("ShowBuzz" for the platform catalogue). */
  createdBy: string;
  upcomingShows: number;
  /** Form values, only when `own`. */
  values?: MovieInput;
}

export interface VendorEventRow {
  id: string;
  kind: EventKind;
  slug: string;
  title: string;
  category: string;
  poster: string;
  venueName: string;
  /** IST label: "14 Oct, 07:00 PM" or "Daily 10:00–20:00". */
  when: string;
  /** Lowest tier price. */
  fromPaise: number;
  capacity: number;
  sold: number;
  status: ListingStatus;
  /** Taken down by ShowBuzz staff (hidden publicly until staff restore it). */
  takenDown?: boolean;
}

/** Per tier: what's sold and reserved (unpaid orders), so the form can show the floor for capacity. */
export interface TierUsage {
  tierId: string;
  sold: number;
  reserved: number;
}

export interface VendorEventDetail {
  id: string;
  kind: EventKind;
  slug: string;
  values: EventInput;
  usage: TierUsage[];
  /** Tickets sold or reserved: the schedule and venue are locked. */
  locked: boolean;
  /** Set when ShowBuzz took the listing down (the vendor can still edit it, but it stays hidden). */
  takedown?: { at: string; reason: string };
}

export interface ScreenOption {
  id: string;
  name: string;
  formats: string[];
  zones: { id: string; name: string; defaultPricePaise: number; seats: number }[];
}

export interface VenueScreenOption {
  id: string;
  name: string;
  kind: "cinema" | "stadium" | "venue";
  cityId: string;
  status: "active" | "inactive";
  screens: ScreenOption[];
}

export interface MovieOption {
  id: string;
  title: string;
  durationMinutes: number;
  languages: string[];
  formats: string[];
}

export type ShowRowStatus = "scheduled" | "cancelled" | "started";

export interface VendorShowRow {
  id: string;
  title: string;
  /** /movies/<id> or /events/<id> in the partner portal. */
  href: string;
  kind: "movie" | "sport";
  venueName: string;
  screenName: string;
  startsAt: string;
  endsAt?: string;
  format: string;
  language: string;
  pricePaise: number;
  sold: number;
  capacity: number;
  status: ShowRowStatus;
  /** Made by the demo generator (seeded cinemas). */
  generated: boolean;
}

/** An existing show that a new one would overlap (with the changeover buffer). */
export interface ShowClash {
  /** IST start of the show being scheduled. */
  requestedStartsAt: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

export interface VendorShowDetail {
  id: string;
  title: string;
  kind: "movie" | "sport";
  venueName: string;
  screenName: string;
  startsAt: string;
  endsAt?: string;
  format: string;
  language: string;
  status: ShowRowStatus;
  generated: boolean;
  /** Formats the screen (and film) allow. */
  formatOptions: string[];
  zones: { zoneId: string; name: string; pricePaise: number }[];
  sold: number;
  held: number;
  capacity: number;
}
