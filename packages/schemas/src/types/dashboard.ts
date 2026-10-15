import type { DashboardRange } from "../dashboard";
import type { BookingKind, BookingStatus } from "./booking";

/** Shapes the admin and partner dashboards render (built by packages/core/src/services/{admin,partner}/dashboard). */

export interface TrendPoint {
  /** "2026-10-15" (day buckets) or "14" (hour buckets, IST). */
  key: string;
  label: string;
  salesPaise: number;
  tickets: number;
}

export interface SalesSlice {
  key: string;
  label: string;
  /** Second line (vendor name, city of a venue, kind of a title). */
  detail?: string;
  salesPaise: number;
  tickets: number;
}

export interface DashboardPeriod {
  range: DashboardRange;
  /** IST date keys, inclusive. */
  fromKey: string;
  toKey: string;
  /** When the figures were computed (they are cached for a few minutes). */
  generatedAt: string;
}

export interface AdminDashboard extends DashboardPeriod {
  kpis: {
    /** Order totals (tickets + food + fees + GST − discount) of vendor bookings sold in the period. */
    grossSalesPaise: number;
    previousGrossSalesPaise: number;
    refundsPaise: number;
    bookings: number;
    /** Tickets of bookings sold in the period and still confirmed. */
    tickets: number;
    previousTickets: number;
    platformRevenuePaise: number;
    previousPlatformRevenuePaise: number;
    revenue: {
      convenienceFeePaise: number;
      commissionPaise: number;
      cancellationFeesPaise: number;
      subscriptionPaise: number;
    };
    activeVendors: number;
    newVendors: number;
    previousNewVendors: number;
    giftCardSalesPaise: number;
    giftCardsSold: number;
  };
  trend: TrendPoint[];
  categories: SalesSlice[];
  topVendors: SalesSlice[];
  topTitles: SalesSlice[];
  cities: SalesSlice[];
  recent: AdminRecentBooking[];
}

export interface AdminRecentBooking {
  code: string;
  customer: string;
  title: string;
  venueName: string;
  vendorName: string;
  scheduleLabel: string;
  totalPaise: number;
  status: BookingStatus;
  channel: "online" | "counter";
  checkedIn: boolean;
  bookedAt: string;
}

export interface ShowOccupancy {
  id: string;
  title: string;
  venueName: string;
  screenName: string;
  startsAt?: string;
  /** Tickets sold (seats or passes). */
  sold: number;
  capacity: number;
  kind: "seated" | "passes";
}

export interface PartnerDashboard extends DashboardPeriod {
  kpis: {
    /** Tickets + food before fees, after nothing (same as Earnings "gross sales"). */
    salesPaise: number;
    previousSalesPaise: number;
    vendorSharePaise: number;
    bookings: number;
    tickets: number;
    previousTickets: number;
    counterBookings: number;
    checkedIn: number;
    refundsPaise: number;
    /** Sold ÷ capacity over shows that started in the period (null when none did). */
    occupancyBps: number | null;
    showsRun: number;
  };
  trend: TrendPoint[];
  topTitles: SalesSlice[];
  upcoming: ShowOccupancy[];
  pastShows: ShowOccupancy[];
  recent: PartnerRecentBooking[];
}

export interface PartnerRecentBooking {
  code: string;
  kind: BookingKind;
  title: string;
  venueName: string;
  scheduleLabel: string;
  seats: string;
  ticketCount: number;
  totalPaise: number;
  status: BookingStatus;
  channel: "online" | "counter";
  checkedIn: boolean;
  bookedAt: string;
}
