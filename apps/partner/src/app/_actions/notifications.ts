"use server";

import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { markNotificationsRead } from "@showbuzz/core/services/notification.service";
import { notificationIdSchema } from "@showbuzz/schemas/notification";

/** Marking a notification read changes only this login's view, so it isn't written to the activity log. */

async function recipient() {
  const { vendorUser, vendor } = await requireVendor();
  return { audience: "vendor" as const, userId: vendorUser.id, vendorId: vendor.id };
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await markNotificationsRead(await recipient(), notificationIdSchema.parse(id));
    return null;
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    await markNotificationsRead(await recipient());
    return null;
  });
}
