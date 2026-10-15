"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

const POLL_MS = 60_000;

/** Fired by the notifications page after marking items read, so the badge updates without a reload. */
export const NOTIFICATIONS_CHANGED_EVENT = "showbuzz:notifications-changed";

/**
 * Top-bar bell with the unread count. The count comes from `countUrl` (`{ success, data: { count } }`), read on
 * load, on every navigation, when the tab regains focus and every minute. A failed read just hides the badge.
 */
export function NotificationBell({ href, countUrl }: { href: string; countUrl: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!countUrl) return;
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(countUrl, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { count?: number } };
        if (!cancelled) setCount(body.data?.count ?? 0);
      } catch {
        // Offline or signed out: keep the last count.
      }
    };
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [countUrl, pathname]);

  const label = count > 0 ? `Notifications, ${count >= 100 ? "99+" : count} unread` : "Notifications";
  return (
    <Link
      href={href}
      className="relative rounded-xl p-2 text-admin-muted hover:bg-slate-100 hover:text-admin-dark"
      aria-label={label}
    >
      <Bell className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-admin-coral px-1 text-[9px] leading-none font-black text-white">
          {count >= 100 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
