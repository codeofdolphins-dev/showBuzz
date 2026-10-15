import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Types } from "@showbuzz/db/mongoose";
import { Notification, type NotificationAttrs } from "@showbuzz/db/models/Notification";
import type { NotificationType, NotificationView } from "@showbuzz/schemas/notification";
import { log } from "@showbuzz/runtime/log";

/**
 * Console notifications. `notify()` is called after the change it reports has been saved and never fails it (like
 * logActivity). Reads are always scoped to the recipient: staff see staff notifications whose permission their role
 * has; a vendor login sees its own vendor's notifications only.
 */

export type NotificationEntry =
  | { audience: "staff"; permission: string; type: NotificationType; title: string; body?: string; link?: string }
  | { audience: "vendor"; vendorId: string; type: NotificationType; title: string; body?: string; link?: string };

export type NotificationRecipient =
  | { audience: "staff"; userId: string; permissions: readonly string[] }
  | { audience: "vendor"; userId: string; vendorId: string };

export async function notify(entry: NotificationEntry): Promise<void> {
  try {
    await connect();
    await Notification.create({
      audience: entry.audience,
      ...(entry.audience === "staff"
        ? { permission: entry.permission }
        : { vendorId: new Types.ObjectId(entry.vendorId) }),
      type: entry.type,
      title: entry.title.slice(0, 160),
      body: (entry.body ?? "").slice(0, 500),
      ...(entry.link ? { link: entry.link } : {}),
    });
  } catch (err) {
    log.error("Notification write failed", {
      event: "notification.write_failed",
      type: entry.type,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function scope(recipient: NotificationRecipient): Record<string, unknown> {
  if (recipient.audience === "staff") {
    return { audience: "staff", permission: { $in: [...recipient.permissions] } };
  }
  return { audience: "vendor", vendorId: new Types.ObjectId(recipient.vendorId) };
}

const unreadBy = (userId: string) => ({ readBy: { $ne: new Types.ObjectId(userId) } });

/** Unread notifications for the bell (capped: the badge shows "99+"). */
export async function countUnreadNotifications(recipient: NotificationRecipient): Promise<number> {
  await connect();
  return Notification.countDocuments({ ...scope(recipient), ...unreadBy(recipient.userId) }).limit(100);
}

export async function listNotifications(
  recipient: NotificationRecipient,
  query: { unreadOnly: boolean; page: number; limit: number },
): Promise<{ rows: NotificationView[]; total: number; unread: number }> {
  await connect();
  const base = scope(recipient);
  const filter = query.unreadOnly ? { ...base, ...unreadBy(recipient.userId) } : base;
  const me = recipient.userId;
  const [docs, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...base, ...unreadBy(me) }),
  ]);
  return {
    total,
    unread,
    rows: docs.map((doc: NotificationAttrs & { _id: Types.ObjectId }) => ({
      id: doc._id.toString(),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      ...(doc.link ? { link: doc.link } : {}),
      read: doc.readBy.some((id) => id.toString() === me),
      createdAt: doc.createdAt.toISOString(),
    })),
  };
}

/** Marks one notification (or, without an id, all of them) read for this person. Others' notifications: no-op. */
export async function markNotificationsRead(recipient: NotificationRecipient, notificationId?: string): Promise<void> {
  await connect();
  const filter: Record<string, unknown> = { ...scope(recipient), ...unreadBy(recipient.userId) };
  if (notificationId) {
    if (!Types.ObjectId.isValid(notificationId)) return;
    filter._id = new Types.ObjectId(notificationId);
  }
  await Notification.updateMany(filter, { $addToSet: { readBy: new Types.ObjectId(recipient.userId) } });
}
