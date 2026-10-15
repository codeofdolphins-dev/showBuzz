import { z } from "zod";
import { objectIdSchema } from "./common";

/**
 * Console notifications (back-office prompt 8). Staff notifications are broadcast to every staff member whose role
 * has the notification's permission; vendor notifications go to every login of that vendor. "Read" is recorded per
 * person (`readBy`), so it stays correct when vendor team roles arrive.
 */

export const NOTIFICATION_TYPES = [
  "vendor_signup",
  "show_submission",
  "refund_created",
  "payout_paid",
  "invoice_issued",
  "listing_takedown",
  "listing_restored",
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const notificationAudienceSchema = z.enum(["staff", "vendor"]);

/** Notifications are removed this long after they were created (TTL index). */
export const NOTIFICATION_TTL_DAYS = 90;

/** Mark one notification read (ids come from the list the server rendered). */
export const notificationIdSchema = objectIdSchema;

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;

/** What a console renders (no recipient lists). */
export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Console path to open, e.g. "/vendors/…". */
  link?: string;
  read: boolean;
  createdAt: string;
}
