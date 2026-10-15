import "server-only";
import { LEGACY_SYSTEM_ROLES, SUPER_ADMIN_ROLE, SYSTEM_ROLES } from "@showbuzz/schemas/permissions";
import { newStaffSchema, resetStaffPasswordSchema } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { Role } from "@showbuzz/db/models/Role";
import { Staff } from "@showbuzz/db/models/Staff";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../../http/app-error";
import { generateTemporaryPassword, hashPassword } from "../password";
import { changeAccountPassword } from "../password-change";
import { staffSessions } from "./sessions";

/** Staff account management: own password, Super Admin resets, role seeding and first-admin creation. */

/**
 * Changes the signed-in staff member's password. Needs the current password; signs out every other device
 * (this one stays signed in). Shared rules: ../password-change.ts.
 */
export async function changeOwnPassword(actor: { staffId: string; sid: string }, input: unknown, now = new Date()) {
  await changeAccountPassword(
    { model: Staff, sessions: staffSessions, label: "staff", accountId: actor.staffId, sid: actor.sid },
    input,
    now,
  );
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
 * Writes the system roles. Idempotent: missing roles are created; Super Admin's permissions are re-synced to the
 * full catalogue (it grows over time); every other system role is re-synced to its definition unless it was edited
 * in the role editor (`customised`), whose edits are kept.
 *
 * Prompt 7 replaced the vendor-style Cinema Manager and Event Manager: a stored legacy role nobody uses is deleted;
 * one still assigned to staff becomes a custom role with the same name and permissions, so nobody's access changes
 * silently (a Super Admin then moves those people and deletes it).
 */
export async function seedSystemRoles(): Promise<{
  created: string[];
  synced: string[];
  retired: string[];
  keptAsCustom: string[];
}> {
  await connect();
  const created: string[] = [];
  const synced: string[] = [];
  for (const role of SYSTEM_ROLES) {
    const isSuperAdmin = role.name === SUPER_ADMIN_ROLE;
    const result = await Role.updateOne(
      { name: role.name },
      {
        $set: { isSystem: true },
        $setOnInsert: { description: role.description, permissions: role.permissions },
      },
      { upsert: true },
    );
    if (result.upsertedCount) {
      created.push(role.name);
      continue;
    }
    const sync = await Role.updateOne(
      isSuperAdmin ? { name: role.name } : { name: role.name, customised: { $ne: true } },
      { $set: { permissions: role.permissions, ...(isSuperAdmin ? {} : { description: role.description }) } },
    );
    if (sync.modifiedCount) synced.push(role.name);
  }

  const retired: string[] = [];
  const keptAsCustom: string[] = [];
  for (const name of LEGACY_SYSTEM_ROLES) {
    const legacy = await Role.findOne({ name }, { _id: 1, isSystem: 1 }).lean();
    if (!legacy) continue;
    if (await Staff.exists({ roleId: legacy._id })) {
      if (legacy.isSystem) {
        await Role.updateOne({ _id: legacy._id }, { $set: { isSystem: false } });
        keptAsCustom.push(name);
      }
    } else {
      await Role.deleteOne({ _id: legacy._id });
      retired.push(name);
    }
  }
  return { created, synced, retired, keptAsCustom };
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
