import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import {
  NOTIFICATION_TTL_DAYS,
  NOTIFICATION_TYPES,
  type NotificationAudience,
  type NotificationType,
} from "@showbuzz/schemas/notification";

/**
 * A console notification. `audience: "staff"` is shown to every staff member whose role has `permission`;
 * `audience: "vendor"` to every login of `vendorId`. `readBy` lists the staff / vendor-user ids that have read it.
 * Written by notify() in @showbuzz/core after the change it reports; removed by TTL after 90 days.
 */
export interface NotificationAttrs {
  audience: NotificationAudience;
  vendorId?: Types.ObjectId;
  permission?: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationAttrs>(
  {
    audience: { type: String, enum: ["staff", "vendor"], required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    permission: { type: String, maxlength: 64 },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: "", maxlength: 500 },
    link: { type: String, maxlength: 200 },
    readBy: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

notificationSchema.index({ audience: 1, permission: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, vendorId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 86_400 });

export const Notification: Model<NotificationAttrs> =
  (models.Notification as Model<NotificationAttrs> | undefined) ??
  model<NotificationAttrs>("Notification", notificationSchema, "notifications");
