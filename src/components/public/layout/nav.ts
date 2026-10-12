import {
  Briefcase,
  Building,
  CalendarDays,
  CircleQuestionMark,
  Dices,
  Drama,
  Film,
  Gift,
  House,
  Megaphone,
  Play,
  Tags,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind text colour for the icon in the drawer and category hubs. */
  color: string;
  badge?: string;
}

export const CATEGORY_NAV: NavItem[] = [
  { href: "/movies", label: "Movies", icon: Film, color: "text-rose-500" },
  { href: "/stream", label: "Stream", icon: Play, color: "text-indigo-500", badge: "Exclusive" },
  { href: "/events", label: "Events", icon: CalendarDays, color: "text-purple-500" },
  { href: "/plays", label: "Plays", icon: Drama, color: "text-amber-500" },
  { href: "/sports", label: "Sports", icon: Trophy, color: "text-emerald-500" },
  { href: "/activities", label: "Activities", icon: Dices, color: "text-pink-500" },
  { href: "/cinemas", label: "Cinemas", icon: Building, color: "text-blue-500" },
];

export const SERVICE_NAV: NavItem[] = [
  { href: "/list-your-show", label: "List Your Show", icon: Megaphone, color: "text-blue-500" },
  { href: "/corporate", label: "Corporate Booking", icon: Briefcase, color: "text-emerald-500" },
  { href: "/offers", label: "Offers", icon: Tags, color: "text-rose-500" },
  { href: "/gift-cards", label: "Gift Cards", icon: Gift, color: "text-purple-500" },
];

export const DRAWER_EXPLORE: NavItem[] = [
  { href: "/", label: "Home", icon: House, color: "text-slate-400" },
  { href: "/movies", label: "Movies", icon: Film, color: "text-rose-500" },
  { href: "/cinemas", label: "Cinemas & Showtimes", icon: Building, color: "text-blue-500" },
  { href: "/stream", label: "Stream Premiere", icon: Play, color: "text-indigo-500" },
  { href: "/events", label: "Events & Gigs", icon: CalendarDays, color: "text-purple-500" },
  { href: "/plays", label: "Plays & Theatre", icon: Drama, color: "text-amber-500" },
  { href: "/sports", label: "Sports Matches", icon: Trophy, color: "text-emerald-500" },
  { href: "/activities", label: "Activities & Fun", icon: Dices, color: "text-pink-500" },
];

export const DRAWER_SERVICES: NavItem[] = [
  { href: "/offers", label: "Offers & Promo Codes", icon: Tags, color: "text-rose-500" },
  { href: "/gift-cards", label: "Gift Cards", icon: Gift, color: "text-purple-500" },
  { href: "/list-your-show", label: "List Your Show", icon: Megaphone, color: "text-blue-500" },
  { href: "/corporate", label: "Corporate Bookings", icon: Briefcase, color: "text-emerald-500" },
  { href: "/faq", label: "24/7 Help & FAQ", icon: CircleQuestionMark, color: "text-slate-400" },
];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
