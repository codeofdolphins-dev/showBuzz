import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { SUPER_ADMIN_ROLE, SYSTEM_ROLES } from "@showbuzz/schemas/permissions";
import { changePasswordSchema, newStaffSchema, resetStaffPasswordSchema } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { Role } from "@showbuzz/db/models/Role";
import { Staff } from "@showbuzz/db/models/Staff";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../../http/app-error";
import { consumeRateLimit } from "../../security/rate-limit";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "./password";
import { staffSessions } from "./sessions";

/** Staff account management: own password, Super Admin resets, role seeding and first-admin creation. */

/**
 * Changes the signed-in staff member's password. Needs the current password; signs out every other device
 * (this one stays signed in).
 */
export async function changeOwnPassword(actor: { staffId: string; sid: string }, input: unknown, now = new Date()) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const limit = await consumeRateLimit(`staff-password:${actor.staffId}`, {
    limit: ADMIN_AUTH.passwordChangeMaxPerWindow,
    windowSec: ADMIN_AUTH.loginWindowSec,
    now,
  });
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  await connect();
  const staff = await Staff.findById(actor.staffId);
  if (!staff || staff.status !== "active") throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
    throw new AppError("VALIDATION_FAILED", "Your current password is incorrect.", 422, {
      fieldErrors: { currentPassword: ["Your current password is incorrect."] },
    });
  }

  await Staff.updateOne(
    { _id: staff._id },
    { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: now } },
  );
  await staffSessions.revokeAllSessions(actor.staffId, actor.sid);
  log.info("Staff password changed", { event: "staff.password_changed", staffId: actor.staffId });
}

/**
 * Super Admin stand-in for "forgot password" while no email provider exists: sets a temporary password for
 * another staff member, signs them out everywhere and returns the password once (it is never stored in clear).
 * The caller must have checked `users:reset-password`.
 */
export async function resetStaffPassword(actor: { staffId: string }, input: unknown, now = new Date()) {
  const { email } = resetStaffPasswordSchema.parse(input);
  await connect();
  const target = await Staff.findOne({ email }, { _id: 1, email: 1 });
  if (!target) throw new AppError("NOT_FOUND", "No staff account uses that email.", 404);
  if (target.id === actor.staffId) {
    throw new AppError("CONFLICT", "Change your own password from your profile.", 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  await Staff.updateOne(
    { _id: target._id },
    { $set: { passwordHash: await hashPassword(temporaryPassword), passwordChangedAt: now } },
  );
  await staffSessions.revokeAllSessions(target.id);
  log.info("Staff password reset by admin", {
    event: "staff.password_reset",
    actorId: actor.staffId,
    staffId: target.id,
  });
  return { email: target.email, temporaryPassword };
}

/**
 * Writes the five system roles. Idempotent: missing roles are created; Super Admin's permissions are re-synced
 * to the full catalogue (it grows over time); other roles keep any edits made in the console.
 */
export async function seedSystemRoles(): Promise<{ created: string[]; synced: string[] }> {
  await connect();
  const created: string[] = [];
  const synced: string[] = [];
  for (const role of SYSTEM_ROLES) {
    const isSuperAdmin = role.name === SUPER_ADMIN_ROLE;
    const result = await Role.updateOne(
      { name: role.name },
      {
        $set: { isSystem: true, ...(isSuperAdmin ? { permissions: role.permissions } : {}) },
        $setOnInsert: { description: role.description, ...(isSuperAdmin ? {} : { permissions: role.permissions }) },
      },
      { upsert: true },
    );
    if (result.upsertedCount) created.push(role.name);
    else if (isSuperAdmin && result.modifiedCount) synced.push(role.name);
  }
  return { created, synced };
}

/** Creates a staff account with an existing role (create-admin script; later the /users screen). */
export async function createStaff(input: unknown, now = new Date()) {
  const { name, email, password, roleId } = newStaffSchema.parse(input);
  await connect();
  if (!(await Role.exists({ _id: roleId }))) throw new AppError("NOT_FOUND", "That role doesn't exist.", 404);
  try {
    const staff = await Staff.create({
      name,
      email,
      roleId,
      passwordHash: await hashPassword(password),
      passwordChangedAt: now,
      status: "active",
    });
    return { id: staff.id, email: staff.email };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === 11000) {
      throw new AppError("CONFLICT", "A staff account with that email already exists.", 409);
    }
    throw err;
  }
}

/** The id of the Super Admin role (seeds the system roles first if needed). */
export async function superAdminRoleId(): Promise<string> {
  await seedSystemRoles();
  const role = await Role.findOne({ name: SUPER_ADMIN_ROLE }, { _id: 1 });
  if (!role) throw new Error("Super Admin role missing after seeding");
  return role.id;
}
