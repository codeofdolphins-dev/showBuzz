import type { BookingPaymentMethod } from "../booking";
import type { CityTier, GenreScope, MasterStatus } from "../master-data";
import type { PageStatus, SitePageSlug } from "../site-content";
import type { StaffStatus } from "../staff";
import type { UserStatus } from "../user";
import type { BookingKind, BookingStatus, OrderAmounts, QuoteFoodLine } from "./booking";
import type { GiftCardStatus } from "./gift-card";
import type { BookingSettlement } from "./vendor";

/** Shapes the super-admin platform screens render (prompt 7; built by packages/core/src/services/admin/*). */

export interface Option {
  value: string;
  label: string;
}

// Master data ------------------------------------------------------------------------------------------------------

export interface AdminCityRow {
  id: string;
  slug: string;
  name: string;
  state: string;
  tier: CityTier;
  popular: boolean;
  status: MasterStatus;
  /** Active cinemas in the city. */
  cinemas: number;
  /** Live shows starting today (IST) in the city. */
  todayShows: number;
}

export interface LanguageRow {
  id: string;
  name: string;
  nativeName: string;
  status: MasterStatus;
  /** Movies listing this language. */
  movies: number;
}

export interface GenreRow {
  id: string;
  name: string;
  slug: string;
  appliesTo: GenreScope;
  status: MasterStatus;
  /** Movies (movie genres) or events (categories) using it. */
  listings: number;
}

// Staff and roles --------------------------------------------------------------------------------------------------

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  status: StaffStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface StaffDetail extends StaffRow {
  activeSessions: number;
  isSelf: boolean;
  /** Changing this account could leave no active Super Admin. */
  isLastSuperAdmin: boolean;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  customised: boolean;
  /** Super Admin: always every permission, can't be renamed or edited. */
  locked: boolean;
  staff: number;
}

// Activity log -----------------------------------------------------------------------------------------------------

export interface ActivityRow {
  id: string;
  createdAt: string;
  actorType: "staff" | "vendor";
  actorName: string;
  vendorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  summary: string;
  changedFields: string[];
  ipPrefix?: string;
}

// Customers --------------------------------------------------------------------------------------------------------

export interface CustomerRow {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: UserStatus;
  joinedAt: string;
  lastLoginAt?: string;
  /** Confirmed (and later cancelled) bookings across every vendor. */
  orders: number;
  /** Amount paid on bookings still confirmed. */
  spendPaise: number;
}

export interface CustomerDetail extends CustomerRow {
  blockedAt?: string;
  blockReason?: string;
  deletedAt?: string;
  activeSessions: number;
  reviews: number;
  giftCardsBought: number;
}

// Bookings ---------------------------------------------------------------------------------------------------------

export interface AdminBookingRow {
  code: string;
  status: BookingStatus;
  kind: BookingKind;
  channel: "online" | "counter";
  title: string;
  venueName: string;
  vendorName?: string;
  startsAt?: string;
  scheduleLabel: string;
  seatLabels: string[];
  ticketCount: number;
  totalPaise: number;
  paymentMethod: BookingPaymentMethod;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  bookedAt: string;
  checkedInAt?: string;
}

export interface AdminBookingDetail extends AdminBookingRow {
  vendorId?: string;
  screenName?: string;
  ticketLabel: string;
  format?: string;
  language?: string;
  food: QuoteFoodLine[];
  amounts: OrderAmounts;
  couponCode?: string;
  giftCardLast4?: string;
  settlement?: BookingSettlement;
  policy?: { allowed: boolean; cutoffMinutes: number; feePaise: number };
  /** Inside the vendor's policy right now. */
  withinPolicy: boolean;
  /** Staff can still cancel it (confirmed, not started, not checked in, not a gift card purchase). */
  staffCanCancel: boolean;
  cancelledAt?: string;
  cancelledBy?: "customer" | "vendor" | "staff";
  cancelledByName?: string;
  cancelReason?: string;
  refundPaise?: number;
  refund?: { status: string; provider: string; amountPaise: number; giftCardPaise: number; feePaise: number };
  payment?: { provider: string; status: string; reference?: string; amountPaise: number };
  payoutCode?: string;
  failureReason?: string;
}

// Reviews ----------------------------------------------------------------------------------------------------------

export interface ReviewRow {
  id: string;
  movieId: string;
  movieTitle: string;
  movieSlug: string;
  authorName: string;
  customerId: string;
  rating: number;
  text: string;
  status: "published" | "hidden";
  updatedAt: string;
  moderatedAt?: string;
}

// Banners ----------------------------------------------------------------------------------------------------------

export interface BannerRow {
  id: string;
  title: string;
  blurb: string;
  badge: string;
  imageUrl: string;
  ctaLabel: string;
  linkUrl: string;
  cityName: string;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
  /** active + inside its dates right now. */
  live: boolean;
}

// Coupons and gift cards -------------------------------------------------------------------------------------------

export interface AdminCouponRow {
  id: string;
  code: string;
  title: string;
  vendorName?: string;
  discountLabel: string;
  minOrderPaise: number;
  usedCount: number;
  usageLimit?: number;
  validUntil: string;
  /** Stored status, with "expired" once validUntil has passed. */
  status: "active" | "inactive" | "expired";
}

export interface GiftCardRow {
  id: string;
  code: string;
  source: "purchase" | "complimentary";
  amountPaise: number;
  balancePaise: number;
  status: GiftCardStatus;
  buyerName?: string;
  recipientName: string;
  expiresAt: string;
  createdAt: string;
}

export interface GiftCardDetail extends GiftCardRow {
  designName?: string;
  recipientContact: string;
  message?: string;
  buyerId?: string;
  buyerContact?: string;
  purchaseBookingCode?: string;
  issuedByName?: string;
  issueReason?: string;
  cancelledAt?: string;
  cancelReason?: string;
  transactions: {
    type: "purchase" | "redeem" | "refund" | "issue" | "cancel";
    amountPaise: number;
    bookingCode?: string;
    staffName?: string;
    at: string;
  }[];
  /** Cancelling also refunds the buyer's purchase in full (never used, purchased online). */
  refundOnCancel: boolean;
}

// Pages and SEO ----------------------------------------------------------------------------------------------------

export interface SitePageRow {
  slug: SitePageSlug;
  name: string;
  path: string;
  status: PageStatus;
  /** Never saved from the console: the site shows the built-in content. */
  usingDefault: boolean;
  updatedAt?: string;
}

export interface SeoRow {
  id: string;
  path: string;
  title: string;
  description: string;
  ogImage: string;
  noindex: boolean;
  updatedAt: string;
}
