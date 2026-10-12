"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Film, House, Ticket, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWishlistStore } from "@/stores/wishlist";
import { isActivePath } from "./nav";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/account/bookings", label: "Tickets", icon: Ticket },
  { href: "/account/profile", label: "Profile", icon: User },
];

/** App-style bottom navigation for phones and tablets. */
export function MobileTabBar() {
  const pathname = usePathname();
  const hasWishlist = useWishlistStore((s) => s.ids.length > 0);

  return (
    <nav className="glass-nav-bottom fixed right-0 bottom-0 left-0 z-50 shadow-2xl lg:hidden">
      <div className="flex h-14 items-center justify-around px-2 sm:h-16">
        {TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "tap-active flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 transition-all hover:text-rose-600",
                active && "font-extrabold text-rose-600",
              )}
            >
              <span className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.label === "Profile" && hasWishlist && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-purple-500" />
                )}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-600" />
                )}
              </span>
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
