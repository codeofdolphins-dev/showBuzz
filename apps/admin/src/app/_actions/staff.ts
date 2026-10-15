"use server";

import { requirePermission, requireStaff } from "@showbuzz/core/auth/admin/current-staff";
import { changeOwnPassword, resetStaffPassword } from "@showbuzz/core/auth/admin/staff-account.service";
import type { CurrentStaff } from "@showbuzz/core/auth/admin/staff-auth.service";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import {
  createRole,
  createStaffByAdmin,
  deleteRole,
  setStaffStatus,
  updateRole,
  updateStaffByAdmin,
} from "@showbuzz/core/services/admin/staff-admin.service";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { actorOf } from "@/lib/actor";

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
    const current = await requirePermission("users:reset-password");
    const result = await resetStaffPassword({ staffId: current.staff.id }, input);
    await logActivity(actorOf(current), {
      action: "staff_password_reset",
      resource: "staff",
      summary: `Set a temporary password for ${result.email}`,
      changedFields: ["passwordHash", "sessions"],
    });
    return result;
  });
}

// Staff accounts and roles (prompt 7)

const actorPermissions = (current: CurrentStaff) => ({
  staffId: current.staff.id,
  permissions: current.staff.permissions,
});

/** New staff member; the temporary password is returned once (share it privately). */
export async function createStaffAction(
  input: unknown,
): Promise<ActionResult<{ id: string; email: string; temporaryPassword: string }>> {
  return runAction(async () => {
    const current = await requirePermission("users:write");
    const created = await createStaffByAdmin(actorPermissions(current), input, new Date());
    await logActivity(actorOf(current), {
      action: "staff_create",
      resource: "staff",
      resourceId: created.id,
      summary: `Added staff member ${created.name}`,
      changedFields: ["name", "email", "roleId"],
    });
    return { id: created.id, email: created.email, temporaryPassword: created.temporaryPassword };
  });
}

export async function updateStaffAction(staffId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("users:write");
    const id = objectIdSchema.parse(staffId);
    const { name, changedFields } = await updateStaffByAdmin(actorPermissions(current), id, input);
    await logActivity(actorOf(current), {
      action: "staff_update",
      resource: "staff",
      resourceId: id,
      summary: `Updated staff member ${name}`,
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function setStaffStatusAction(staffId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("users:write");
    const id = objectIdSchema.parse(staffId);
    const { name, status } = await setStaffStatus(actorPermissions(current), id, input);
    await logActivity(actorOf(current), {
      action: status === "disabled" ? "staff_disable" : "staff_enable",
      resource: "staff",
      resourceId: id,
      summary: `${status === "disabled" ? "Disabled" : "Enabled"} staff member ${name}`,
      changedFields: ["status"],
    });
    return { saved: true as const };
  });
}

export async function createRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("roles:write");
    const role = await createRole(actorPermissions(current), input);
    await logActivity(actorOf(current), {
      action: "role_create",
      resource: "role",
      resourceId: role.id,
      summary: `Created role ${role.name}`,
      changedFields: ["name", "description", "permissions"],
    });
    return { id: role.id };
  });
}

export async function updateRoleAction(roleId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("roles:write");
    const id = objectIdSchema.parse(roleId);
    const { name, changedFields } = await updateRole(actorPermissions(current), id, input);
    await logActivity(actorOf(current), {
      action: "role_update",
      resource: "role",
      resourceId: id,
      summary: `Updated role ${name}`,
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function deleteRoleAction(roleId: unknown): Promise<ActionResult<{ deleted: true }>> {
  return runAction(async () => {
    const current = await requirePermission("roles:write");
    const id = objectIdSchema.parse(roleId);
    const { name } = await deleteRole(id);
    await logActivity(actorOf(current), {
      action: "role_delete",
      resource: "role",
      resourceId: id,
      summary: `Deleted role ${name}`,
      changedFields: [],
    });
    return { deleted: true as const };
  });
}
