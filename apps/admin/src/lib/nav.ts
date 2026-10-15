import { filterNav, findNavItemIn, type NavGroup, type NavItem } from "@showbuzz/console-ui/nav";
import { hasPermission } from "@showbuzz/schemas/permissions";

/**
 * The admin console menu, grouped like the prototype (showBuzz_HTML/admin/assets/js/app.js), minus what vendors run
 * themselves in the partner portal since prompt 7 (venues, screens, seat layouts, shows, gate scanning, counter
 * sales). Offers are the coupons listed on /offers, so "Offers & Bank Deals" is folded into Coupons. Plain data (types in
 * @showbuzz/console-ui/nav) so the server can filter it by permission and pass it to client components. An item
 * without `permission` is open to every signed-in staff member.
 */

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
    id: "box-office",
    label: "Box Office & Sales",
    icon: "ticket",
    children: [
      { id: "bookings", label: "Bookings CRM", icon: "ticket", href: "/bookings", permission: "bookings:read" },
      { id: "payments", label: "Payment Gateway", icon: "credit-card", href: "/payments", permission: "payments:read" },
      { id: "refunds", label: "Refunds", icon: "rotate-ccw", href: "/refunds", permission: "refunds:read" },
      {
        id: "customers",
        label: "Customers Database",
        icon: "users",
        href: "/customers",
        permission: "customers:read",
      },
    ],
  },
  {
    id: "vendors-group",
    label: "Vendors & Billing",
    icon: "briefcase",
    children: [
      // The resource stays "organisers" (the prototype's name) so roles already stored keep working.
      { id: "vendors", label: "Vendors", icon: "briefcase", href: "/vendors", permission: "organisers:read" },
      {
        id: "settlements",
        label: "Vendor Payouts",
        icon: "wallet",
        href: "/settlements",
        permission: "settlements:read",
      },
      {
        id: "invoices",
        label: "Subscription Invoices",
        icon: "file-text",
        href: "/invoices",
        permission: "invoices:read",
      },
      { id: "plans", label: "Subscription Plans", icon: "layers", href: "/plans", permission: "plans:read" },
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

/** The menu with every item the staff member can't open removed (and groups left empty dropped). */
export function navFor(permissions: readonly string[]): NavGroup[] {
  return filterNav(NAV, (permission) => !permission || hasPermission(permissions, permission));
}

/** The menu item for a path such as "/movies" or "/bookings/new", if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  return findNavItemIn(NAV, pathname);
}
