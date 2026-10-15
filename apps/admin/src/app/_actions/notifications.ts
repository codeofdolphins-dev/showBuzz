"use server";

import { requireStaff } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { markNotificationsRead } from "@showbuzz/core/services/notification.service";
import { notificationIdSchema } from "@showbuzz/schemas/notification";

/** Marking a notification read changes only this staff member's view, so it isn't written to the activity log. */

async function recipient() {
  const { staff } = await requireStaff();
  return { audience: "staff" as const, userId: staff.id, permissions: staff.permissions };
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
