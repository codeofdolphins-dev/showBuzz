import type { Screen, ScreenLayoutType, SeatAccent, VenueKind, VenueStatus } from "../venue";

/** Partner portal views of the vendor's venues, screens and live seat maps (built in core/services/partner). */

export interface VendorVenueRow {
  id: string;
  name: string;
  slug: string;
  kind: VenueKind;
  cityName: string;
  address: string;
  status: VenueStatus;
  screens: number;
  /** Sellable seats over all screens (layout-blocked seats excluded). */
  capacity: number;
  updatedAt: string;
}

export interface ScreenCategorySummary {
  name: string;
  accent: SeatAccent;
  seats: number;
  defaultPricePaise: number;
}

export interface VendorScreenSummary {
  id: string;
  name: string;
  layoutType: ScreenLayoutType;
  formats: string[];
  soundSystem: string;
  rows: number;
  capacity: number;
  blockedSeats: number;
  accessibleSeats: number;
  categories: ScreenCategorySummary[];
  /** Shows on this screen that haven't started yet. */
  upcomingShows: number;
}

export interface VendorVenueDetail {
  id: string;
  name: string;
  slug: string;
  kind: VenueKind;
  cityId: string;
  cityName: string;
  address: string;
  phone: string;
  amenities: string[];
  cancellationAllowed: boolean;
  status: VenueStatus;
  updatedAt: string;
  screens: VendorScreenSummary[];
}

/** A screen of the vendor's, for the Seat Layouts list. */
export interface VendorLayoutRow extends VendorScreenSummary {
  venueId: string;
  venueName: string;
}

/** A seat that is sold or held for an upcoming show: the designer may not remove it or change its category. */
export interface LockedSeat {
  seatId: string;
  zoneId: string;
  shows: number;
}

export interface SeatLayoutView {
  venue: { id: string; name: string; kind: VenueKind };
  screen: Screen;
  /** Version the designer saves against (optimistic concurrency). */
  updatedAt: string;
  upcomingShows: number;
  lockedSeats: LockedSeat[];
}

/** One upcoming show that blocks a layout change, with the seats concerned. */
export interface LayoutConflictShow {
  id: string;
  title: string;
  startsAt?: string;
  seats: string[];
}

/**
 * A seat on the live map: `pending` = held for an order waiting for payment, `held` = in someone's checkout,
 * `blocked` = taken off sale for this show, `unavailable` = blocked in the layout itself.
 */
export type SeatBoardState = "free" | "sold" | "pending" | "held" | "blocked" | "unavailable";

export interface SeatBoardSeat {
  id: string;
  number: number;
  state: SeatBoardState;
  accessible: boolean;
}

export interface SeatBoardZone {
  id: string;
  name: string;
  accent: SeatAccent;
  /** This show's price (the layout default when the show has no price for the category). */
  pricePaise: number;
  rows: { row: string; aislesAfter: number[]; seats: SeatBoardSeat[] }[];
}

export interface ShowSeatBoard {
  show: {
    id: string;
    title: string;
    venueName: string;
    screenName: string;
    startsAt?: string;
    /** Started shows are read-only. */
    started: boolean;
  };
  layoutType: ScreenLayoutType;
  zones: SeatBoardZone[];
  counts: Record<SeatBoardState, number>;
}

export interface ShowOption {
  id: string;
  label: string;
}
