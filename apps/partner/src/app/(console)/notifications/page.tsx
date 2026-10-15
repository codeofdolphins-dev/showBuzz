import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@showbuzz/utils/cn";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { NotificationsList, NotificationsPager } from "@showbuzz/console-ui/NotificationsList";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { buildHref, param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listNotifications } from "@showbuzz/core/services/notification.service";
import { load } from "@/lib/load";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/_actions/notifications";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 25;

/** Prototype notifications.html, for the vendor: notifications of the session's vendor only. */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const { vendorUser, vendor } = await requireVendorPage("/notifications");
  const sp = await searchParams;
  const unreadOnly = param(sp, "filter") === "unread";
  const page = Math.max(1, Math.floor(Number(param(sp, "page")) || 1));
  const result = await load(() =>
    listNotifications(
      { audience: "vendor", userId: vendorUser.id, vendorId: vendor.id },
      { unreadOnly, page, limit: PAGE_SIZE },
    ),
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        crumb="Notifications"
        subtitle="Payouts and subscription invoices from ShowBuzz."
      />
      <FilterTabs unreadOnly={unreadOnly} sp={sp} />
      {!result.ok ? (
        <TableError message="Notifications couldn't be loaded. Try again." />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description="Payouts paid to you and subscription invoices appear here."
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
