import { findNavItemIn, type NavGroup, type NavItem } from "@showbuzz/console-ui/nav";

/**
 * The partner portal menu (agreed in back-office prompt 2). One login per vendor for now, so every item is open to
 * every signed-in vendor; `permission` stays unused until vendor team roles exist. Screens arrive in prompts 3–5;
 * until then the catch-all route shows "Coming soon".
 */
export const PARTNER_NAV: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/dashboard" },
  {
    id: "venues-group",
    label: "Venues",
    icon: "map-pin",
    children: [
      { id: "venues", label: "Venues & Screens", icon: "map-pin", href: "/venues" },
      { id: "seat-layouts", label: "Seat Layouts", icon: "grid", href: "/seat-layouts" },
    ],
  },
  {
    id: "listings",
    label: "Listings",
    icon: "film",
    children: [
      { id: "movies", label: "Movies", icon: "film", href: "/movies" },
      { id: "events", label: "Events", icon: "calendar-days", href: "/events" },
      { id: "shows", label: "Shows", icon: "clock", href: "/shows" },
    ],
  },
  {
    id: "box-office",
    label: "Box Office",
    icon: "ticket",
    children: [
      { id: "bookings", label: "Bookings", icon: "ticket", href: "/bookings" },
      { id: "scan-tickets", label: "Scan Tickets", icon: "qr-code", href: "/scan-tickets" },
      { id: "food", label: "Food & Beverages", icon: "utensils", href: "/food" },
    ],
  },
  { id: "offers", label: "Offers & Coupons", icon: "percent", href: "/offers" },
  {
    id: "business",
    label: "Business",
    icon: "briefcase",
    children: [
      {
        id: "cancellation-policy",
        label: "Cancellation Policy",
        icon: "rotate-ccw",
        href: "/cancellation-policy",
      },
      { id: "earnings", label: "Earnings", icon: "wallet", href: "/earnings" },
      { id: "reports", label: "Reports", icon: "bar-chart", href: "/reports" },
      { id: "business-profile", label: "Business Profile", icon: "building", href: "/business-profile" },
    ],
  },
];

/** Bottom tabs on phones (after Home). */
export const PARTNER_TAB_IDS = ["shows", "bookings", "scan-tickets"];

/** The menu item for a path such as "/venues", if any. */
export function findPartnerNavItem(pathname: string): NavItem | undefined {
  return findNavItemIn(PARTNER_NAV, pathname);
}
