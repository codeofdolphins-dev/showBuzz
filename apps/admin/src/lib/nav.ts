import { hasPermission } from "@showbuzz/schemas/permissions";

/**
 * The console menu, grouped like the prototype (showBuzz_HTML/admin/assets/js/app.js). Plain data (icons are
 * names, mapped to lucide components in the client shell) so the server can filter it by permission and pass
 * it to client components. An item without `permission` is open to every signed-in staff member.
 */

export type NavIcon =
  | "layout-dashboard"
  | "film"
  | "calendar-days"
  | "theater"
  | "trophy"
  | "compass"
  | "tv"
  | "grid"
  | "video"
  | "monitor"
  | "map-pin"
  | "armchair"
  | "clock"
  | "ticket"
  | "qr-code"
  | "plus-circle"
  | "credit-card"
  | "rotate-ccw"
  | "wallet"
  | "users"
  | "briefcase"
  | "send"
  | "tag"
  | "image"
  | "percent"
  | "gift"
  | "star"
  | "bar-chart"
  | "trending-up"
  | "settings"
  | "globe"
  | "languages"
  | "layers"
  | "folder"
  | "file-text"
  | "search"
  | "user-check"
  | "shield-check"
  | "scroll-text"
  | "database";

export interface NavItem {
  id: string;
  label: string;
  icon: NavIcon;
  href: string;
  permission?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: NavIcon;
  /** A single link (Dashboard, Show Scheduling) instead of a dropdown. */
  href?: string;
  permission?: string;
  children?: NavItem[];
}

export const NAV: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/dashboard" },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: "film",
    children: [
      { id: "movies", label: "Movies Catalog", icon: "film", href: "/movies", permission: "movies:read" },
      { id: "events", label: "Events & Concerts", icon: "calendar-days", href: "/events", permission: "events:read" },
      { id: "plays", label: "Plays & Drama", icon: "theater", href: "/plays", permission: "plays:read" },
      { id: "sports", label: "Sports Ticketing", icon: "trophy", href: "/sports", permission: "sports:read" },
      {
        id: "activities",
        label: "Activities & Fun",
        icon: "compass",
        href: "/activities",
        permission: "activities:read",
      },
      { id: "streaming", label: "Online Streams", icon: "tv", href: "/streaming", permission: "streaming:read" },
    ],
  },
  {
    id: "venues-group",
    label: "Venues & Seating",
    icon: "grid",
    children: [
      { id: "cinemas", label: "Cinemas & Multiplexes", icon: "video", href: "/cinemas", permission: "cinemas:read" },
      { id: "screens", label: "Screens & Auditoriums", icon: "monitor", href: "/screens", permission: "screens:read" },
      { id: "venues", label: "Venues & Stadiums", icon: "map-pin", href: "/venues", permission: "venues:read" },
      {
        id: "seat-layout",
        label: "Seat Layout Designer",
        icon: "grid",
        href: "/seat-layout",
        permission: "seat-layout:read",
      },
      {
        id: "seat-management",
        label: "Seat Management & Holds",
        icon: "armchair",
        href: "/seat-management",
        permission: "seat-management:read",
      },
    ],
  },
  { id: "shows", label: "Show Scheduling", icon: "clock", href: "/shows", permission: "shows:read" },
  {
    id: "box-office",
    label: "Box Office & Sales",
    icon: "ticket",
    children: [
      { id: "scan-qr", label: "Scan QR Tickets", icon: "qr-code", href: "/scan-qr", permission: "scan-qr:use" },
      {
        id: "booking-form",
        label: "New Booking (POS)",
        icon: "plus-circle",
        href: "/bookings/new",
        permission: "bookings:write",
      },
      { id: "bookings", label: "Bookings CRM", icon: "ticket", href: "/bookings", permission: "bookings:read" },
      { id: "payments", label: "Payment Gateway", icon: "credit-card", href: "/payments", permission: "payments:read" },
      { id: "refunds", label: "Refund Requests", icon: "rotate-ccw", href: "/refunds", permission: "refunds:read" },
      {
        id: "settlements",
        label: "Organiser Payouts",
        icon: "wallet",
        href: "/settlements",
        permission: "settlements:read",
      },
      {
        id: "customers",
        label: "Customers Database",
        icon: "users",
        href: "/customers",
        permission: "customers:read",
      },
      {
        id: "organisers",
        label: "Event Organisers",
        icon: "briefcase",
        href: "/organisers",
        permission: "organisers:read",
      },
      {
        id: "list-your-show",
        label: "List Your Show Requests",
        icon: "send",
        href: "/list-your-show",
        permission: "list-your-show:read",
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: "tag",
    children: [
      { id: "banners", label: "Marketing Banners", icon: "image", href: "/banners", permission: "banners:read" },
      { id: "offers", label: "Offers & Bank Deals", icon: "tag", href: "/offers", permission: "offers:read" },
      { id: "coupons", label: "Coupons & Promos", icon: "percent", href: "/coupons", permission: "coupons:read" },
      { id: "gift-cards", label: "Gift Cards", icon: "gift", href: "/gift-cards", permission: "gift-cards:read" },
      { id: "reviews", label: "Customer Reviews", icon: "star", href: "/reviews", permission: "reviews:read" },
    ],
  },
  {
    id: "reports-group",
    label: "Reports & Analytics",
    icon: "bar-chart",
    children: [
      {
        id: "reports",
        label: "Sales Reports & Export",
        icon: "bar-chart",
        href: "/reports",
        permission: "reports:read",
      },
      {
        id: "analytics",
        label: "Audience Analytics",
        icon: "trending-up",
        href: "/analytics",
        permission: "analytics:read",
      },
    ],
  },
  {
    id: "system",
    label: "Master Data & System",
    icon: "settings",
    children: [
      { id: "cities", label: "Cities & Regions", icon: "globe", href: "/cities", permission: "cities:read" },
      { id: "languages", label: "Languages", icon: "languages", href: "/languages", permission: "languages:read" },
      { id: "genres", label: "Content Genres", icon: "layers", href: "/genres", permission: "genres:read" },
      {
        id: "media-library",
        label: "Media Library",
        icon: "folder",
        href: "/media-library",
        permission: "media-library:read",
      },
      { id: "pages", label: "Website Pages", icon: "file-text", href: "/pages", permission: "pages:read" },
      { id: "seo", label: "SEO & Meta Tags", icon: "search", href: "/seo", permission: "seo:read" },
      { id: "users", label: "Staff & Operators", icon: "user-check", href: "/users", permission: "users:read" },
      { id: "roles", label: "Role Permissions", icon: "shield-check", href: "/roles", permission: "roles:read" },
      {
        id: "activity-log",
        label: "Activity Logs",
        icon: "scroll-text",
        href: "/activity-log",
        permission: "activity-log:read",
      },
      { id: "settings", label: "Platform Settings", icon: "settings", href: "/settings", permission: "settings:read" },
      { id: "backup", label: "Backup & Restore", icon: "database", href: "/backup", permission: "backup:read" },
    ],
  },
];

const canSee = (granted: readonly string[], permission?: string) => !permission || hasPermission(granted, permission);

/** The menu with every item the staff member can't open removed (and groups left empty dropped). */
export function navFor(permissions: readonly string[]): NavGroup[] {
  return NAV.flatMap((group) => {
    if (!group.children) return canSee(permissions, group.permission) ? [group] : [];
    const children = group.children.filter((item) => canSee(permissions, item.permission));
    return children.length ? [{ ...group, children }] : [];
  });
}

/** Flat list of pages (command palette, coming-soon routing). */
export function flattenNav(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) =>
    group.children ?? (group.href ? [{ id: group.id, label: group.label, icon: group.icon, href: group.href, ...(group.permission ? { permission: group.permission } : {}) }] : []),
  );
}

/** The menu item for a path such as "/movies" or "/bookings/new", if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  return flattenNav(NAV).find((item) => item.href === pathname);
}
