import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { ActivityActorType } from "@showbuzz/schemas/activity-log";

/**
 * One back-office change: who (staff member or vendor login), for which vendor, what action on which record, and
 * the names of the fields that changed (never the values). Written by logActivity() in @showbuzz/core; read by the
 * admin activity-log page (prompt 7). Entries are never edited.
 */
export interface ActivityLogAttrs {
  actorType: ActivityActorType;
  /** Staff id or vendor-user id. */
  actorId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  summary: string;
  changedFields: string[];
  /** IP /24 (or /48) prefix only. */
  ipPrefix?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<ActivityLogAttrs>(
  {
    actorType: { type: String, enum: ["staff", "vendor"], required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    action: { type: String, required: true, maxlength: 48 },
    resource: { type: String, required: true, maxlength: 48 },
    resourceId: { type: String, maxlength: 64 },
    summary: { type: String, required: true, maxlength: 300 },
    changedFields: { type: [String], default: [] },
    ipPrefix: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ vendorId: 1, createdAt: -1 });
activityLogSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

export const ActivityLog: Model<ActivityLogAttrs> =
  (models.ActivityLog as Model<ActivityLogAttrs> | undefined) ??
  model<ActivityLogAttrs>("ActivityLog", activityLogSchema, "activityLogs");
