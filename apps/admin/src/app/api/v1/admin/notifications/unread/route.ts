import { requireStaff } from "@showbuzz/core/auth/admin/current-staff";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { ok } from "@showbuzz/core/http/responses";
import { countUnreadNotifications } from "@showbuzz/core/services/notification.service";

/** Unread notifications for the signed-in staff member's bell (only those their role may see). Capped at 100. */
export const GET = apiHandler({}, async () => {
  const { staff } = await requireStaff();
  const count = await countUnreadNotifications({
    audience: "staff",
    userId: staff.id,
    permissions: staff.permissions,
  });
  return ok({ count });
});
