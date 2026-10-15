import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@showbuzz/utils/cn";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { NotificationsList, NotificationsPager } from "@showbuzz/console-ui/NotificationsList";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { buildHref, param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listNotifications } from "@showbuzz/core/services/notification.service";
import { load } from "@/lib/load";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/_actions/notifications";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 25;

/**
 * Prototype notifications.html. Staff see the notifications their role may act on (vendor signups need
 * `organisers:read`, list-your-show requests `list-your-show:read`, refunds `refunds:read`).
 */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const { staff } = await requireStaffPage("/notifications");
  const sp = await searchParams;
  const unreadOnly = param(sp, "filter") === "unread";
  const page = Math.max(1, Math.floor(Number(param(sp, "page")) || 1));
  const result = await load(() =>
    listNotifications(
      { audience: "staff", userId: staff.id, permissions: staff.permissions },
      { unreadOnly, page, limit: PAGE_SIZE },
    ),
  );

  return (
    <>
      <PageHeader title="Notifications" crumb="Notifications" subtitle="Vendor signups, show requests and refunds." />
      <FilterTabs unreadOnly={unreadOnly} sp={sp} />
      {!result.ok ? (
        <TableError message="Notifications couldn't be loaded. Try again." />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description="New vendor signups, list-your-show requests and refunds appear here."
        />
      ) : (
        <>
          <NotificationsList
            rows={result.data.rows}
            unread={result.data.unread}
            markRead={markNotificationReadAction}
            markAllRead={markAllNotificationsReadAction}
          />
          <NotificationsPager
            page={page}
            pages={Math.ceil(result.data.total / PAGE_SIZE)}
            hrefFor={[
              buildHref("/notifications", sp, { page: page - 1 }),
              buildHref("/notifications", sp, { page: page + 1 }),
            ]}
          />
        </>
      )}
    </>
  );
}

function FilterTabs({ unreadOnly, sp }: { unreadOnly: boolean; sp: Record<string, string | string[] | undefined> }) {
  const tab = (active: boolean) =>
    cn(
      "rounded-lg px-3 py-1.5 text-xs font-semibold",
      active ? "bg-admin-indigo text-white" : "bg-white text-admin-muted hover:text-admin-indigo",
    );
  return (
    <div className="flex gap-2">
      <Link href={buildHref("/notifications", sp, { filter: undefined, page: undefined })} className={tab(!unreadOnly)}>
        All
      </Link>
      <Link href={buildHref("/notifications", sp, { filter: "unread", page: undefined })} className={tab(unreadOnly)}>
        Unread
      </Link>
    </div>
  );
}
