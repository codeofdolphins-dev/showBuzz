import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { ok } from "@showbuzz/core/http/responses";
import { countUnreadNotifications } from "@showbuzz/core/services/notification.service";

/** Unread notifications of the signed-in vendor (scoped by the session's vendor id) for the bell. Capped at 100. */
export const GET = apiHandler({}, async () => {
  const { vendorUser, vendor } = await requireVendor();
  const count = await countUnreadNotifications({ audience: "vendor", userId: vendorUser.id, vendorId: vendor.id });
  return ok({ count });
});
