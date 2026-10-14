import "server-only";
import { headers } from "next/headers";
import {
  activityActorSchema,
  activityEntrySchema,
  type ActivityActor,
  type ActivityEntryInput,
} from "@showbuzz/schemas/activity-log";
import { connect } from "@showbuzz/db/connect";
import { ActivityLog } from "@showbuzz/db/models/ActivityLog";
import { log } from "@showbuzz/runtime/log";
import { getClientIp, ipPrefix } from "../http/request";

/**
 * Records a back-office change. Call it after the change succeeded, from the Server Action or service that made it.
 * The IP prefix comes from the request headers. A logging failure is reported in the server log but never fails the
 * save it describes (the change already happened).
 */
export async function logActivity(actor: ActivityActor, entry: ActivityEntryInput): Promise<void> {
  try {
    const who = activityActorSchema.parse(actor);
    const what = activityEntrySchema.parse(entry);
    const prefix = ipPrefix(getClientIp(await headers()));
    await connect();
    await ActivityLog.create({
      actorType: who.type,
      actorId: who.id,
      ...(who.vendorId ? { vendorId: who.vendorId } : {}),
      action: what.action,
      resource: what.resource,
      ...(what.resourceId ? { resourceId: what.resourceId } : {}),
      summary: what.summary,
      changedFields: [...new Set(what.changedFields)],
      ...(prefix ? { ipPrefix: prefix } : {}),
    });
  } catch (err) {
    log.error("Activity log write failed", {
      event: "activity_log.write_failed",
      action: entry.action,
      resource: entry.resource,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/** Names of the fields whose values differ between `before` and `after` (shallow, JSON comparison). */
export function changedFieldNames(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
