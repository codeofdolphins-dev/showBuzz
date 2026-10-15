"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeIndianRupee,
  Briefcase,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  type LucideIcon,
  RotateCcw,
  Send,
  Bell,
} from "lucide-react";
import type { NotificationType, NotificationView } from "@showbuzz/schemas/notification";
import { cn } from "@showbuzz/utils/cn";
import { NOTIFICATIONS_CHANGED_EVENT } from "./NotificationBell";
import { useToast } from "./Toaster";

type MarkResult = { success: true } | { success: false; error: { message: string } };

const TYPE_ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  vendor_signup: { icon: Briefcase, tone: "bg-indigo-50 text-admin-indigo" },
  show_submission: { icon: Send, tone: "bg-rose-50 text-admin-coral" },
  refund_created: { icon: RotateCcw, tone: "bg-amber-50 text-amber-700" },
  payout_paid: { icon: BadgeIndianRupee, tone: "bg-emerald-50 text-admin-success" },
  invoice_issued: { icon: FileText, tone: "bg-teal-50 text-admin-teal" },
  listing_takedown: { icon: EyeOff, tone: "bg-red-50 text-admin-danger" },
  listing_restored: { icon: Eye, tone: "bg-emerald-50 text-admin-success" },
};

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * Prototype notifications.html: one row per notification, unread ones highlighted. Opening a row marks it read and
 * follows its link; "Mark all as read" clears the badge. The Server Actions come from the app (staff or vendor scope).
 */
export function NotificationsList({
  rows,
  markRead,
  markAllRead,
  unread,
}: {
  rows: NotificationView[];
  unread: number;
  markRead: (id: string) => Promise<MarkResult>;
  markAllRead: () => Promise<MarkResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

  function open(row: NotificationView) {
    startTransition(async () => {
      if (!row.read) {
        const result = await markRead(row.id);
        if (!result.success) {
          toast.error(result.error.message);
          return;
        }
        changed();
      }
      if (row.link) router.push(row.link);
      else router.refresh();
    });
  }

  function readAll() {
    startTransition(async () => {
      const result = await markAllRead();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      changed();
      toast.success("All notifications marked as read.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-admin-muted">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        <button
          type="button"
          onClick={readAll}
          disabled={pending || unread === 0}
          className="rounded-md border border-admin-border bg-white px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-slate-50 disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>
      <ul className="divide-y divide-admin-border rounded-xl border border-admin-border bg-white shadow-card">
        {rows.map((row) => {
          const { icon: Icon, tone } = TYPE_ICONS[row.type] ?? { icon: Bell, tone: "bg-slate-100 text-admin-muted" };
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => open(row)}
                disabled={pending}
                className={cn(
                  "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50 disabled:cursor-wait",
                  !row.read && "bg-admin-active/40",
                )}
              >
                <span
                  className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", tone)}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {!row.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-admin-coral" aria-hidden /> : null}
                    <span className={cn("text-xs text-admin-dark", row.read ? "font-semibold" : "font-bold")}>
                      {row.title}
                    </span>
                    {!row.read ? <span className="sr-only">(unread)</span> : null}
                  </span>
                  {row.body ? <span className="mt-0.5 block text-xs text-admin-muted">{row.body}</span> : null}
                  <span className="mt-1 block font-mono text-[10px] text-admin-subtle">
                    {timeFormat.format(new Date(row.createdAt))}
                  </span>
                </span>
                {row.link ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-admin-subtle" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Prev / next links under the list. */
export function NotificationsPager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: string[] }) {
  if (pages <= 1) return null;
  const [prev, next] = hrefFor;
  const link = "rounded-md border border-admin-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-xs text-admin-muted">
      {page > 1 && prev ? (
        <Link href={prev} className={link}>
          Previous
        </Link>
      ) : null}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages && next ? (
        <Link href={next} className={link}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
