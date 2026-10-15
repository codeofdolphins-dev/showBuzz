import type { AnalyticsRange, ListingKind } from "../admin-catalog";
import type { BookingStatus } from "./booking";

/** Shapes of the admin catalogue oversight screens (services/admin/{listing,stream,media,analytics}-admin). */

export interface AdminListingRow {
  id: string;
  kind: ListingKind;
  slug: string;
  title: string;
  category: string;
  poster: string;
  vendorId: string;
  vendorName: string;
  venueName: string;
  cityName: string;
  /** "14 Oct, 07:00 PM" or "Daily 10:00–20:00" (IST). */
  when: string;
  past: boolean;
  sold: number;
  capacity: number;
  status: "active" | "inactive";
  takenDown: boolean;
}

export interface AdminListingDetail extends AdminListingRow {
  about: string;
  language?: string;
  ageLimit?: string;
  durationLabel?: string;
  publicUrl: string;
  tiers: { id: string; name: string; pricePaise: number; capacity: number; sold: number; reserved: number }[];
  takedown?: { at: string; reason: string; byName: string };
  bookings: {
    code: string;
    customer: string;
    tickets: string;
    ticketCount: number;
    totalPaise: number;
    status: BookingStatus;
    channel: "online" | "counter";
    bookedAt: string;
  }[];
  createdAt: string;
}

export interface AdminStreamRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  badge: string;
  poster: string;
  rentPricePaise: number;
  buyPricePaise: number;
  durationMinutes: number;
  rating: number;
  featured: boolean;
  status: "active" | "inactive";
  sortOrder: number;
}

export interface AdminMediaRow {
  id: string;
  /** Path to use in image fields: "/media/<id>". */
  url: string;
  filename: string;
  contentType: string;
  size: number;
  alt: string;
  uploadedBy: string;
  createdAt: string;
}

export interface AudienceAnalytics {
  range: AnalyticsRange;
  fromKey: string;
  toKey: string;
  generatedAt: string;
  bookings: number;
  /** Bookings by IST hour of payment, 0–23. */
  byHour: number[];
  /** [weekday 0 = Monday][hour 0–23]. */
  heatmap: number[][];
  devices: { key: string; label: string; bookings: number }[];
  leadTime: { key: string; label: string; bookings: number }[];
  channels: { key: string; label: string; bookings: number }[];
  customers: { total: number; returning: number; new: number };
  avgTicketsPerOrder: number;
  cancellationRateBps: number;
}
