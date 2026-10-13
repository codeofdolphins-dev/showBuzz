"use server";

import { requirePermission, requireStaff } from "@showbuzz/core/auth/admin/current-staff";
import { changeOwnPassword, resetStaffPassword } from "@showbuzz/core/auth/admin/staff-account.service";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";

/** Changes the signed-in staff member's own password (current password required); other devices sign out. */
export async function changePasswordAction(input: unknown): Promise<ActionResult<{ changed: true }>> {
  return runAction(async () => {
    const { staff, sid } = await requireStaff();
    await changeOwnPassword({ staffId: staff.id, sid }, input);
    return { changed: true as const };
  });
}

/**
 * Super Admin stand-in for password recovery (no email provider yet): sets a temporary password for another
 * staff member and returns it once.
 */
export async function resetStaffPasswordAction(
  input: unknown,
): Promise<ActionResult<{ email: string; temporaryPassword: string }>> {
  return runAction(async () => {
    const { staff } = await requirePermission("users:reset-password");
    return resetStaffPassword({ staffId: staff.id }, input);
  });
}
