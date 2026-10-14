"use server";

import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { changeOwnVendorPassword } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";

/** Changes the signed-in vendor user's own password (current password required); other devices sign out. */
export async function changePasswordAction(input: unknown): Promise<ActionResult<{ changed: true }>> {
  return runAction(async () => {
    const { vendorUser, vendor, sid } = await requireVendor();
    await changeOwnVendorPassword({ vendorUserId: vendorUser.id, sid }, input);
    await logActivity(
      { type: "vendor", id: vendorUser.id, vendorId: vendor.id },
      {
        action: "password_change",
        resource: "vendor_user",
        resourceId: vendorUser.id,
        summary: "Changed own password",
        changedFields: ["passwordHash"],
      },
    );
    return { changed: true as const };
  });
}
