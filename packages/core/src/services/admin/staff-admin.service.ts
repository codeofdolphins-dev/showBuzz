import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Role, type RoleAttrs } from "@showbuzz/db/models/Role";
import { Staff, type StaffAttrs } from "@showbuzz/db/models/Staff";
import type { ClientSession, Types } from "@showbuzz/db/mongoose";
import { SUPER_ADMIN_ROLE, VENDOR_RUN_RESOURCES } from "@showbuzz/schemas/permissions";
import {
  type StaffStatus,
  createStaffByAdminSchema,
  roleSchema,
  staffStatusChangeSchema,
  updateStaffSchema,
} from "@showbuzz/schemas/staff";
import type { Option, RoleRow, StaffDetail, StaffRow } from "@showbuzz/schemas/types/admin-platform";
import { generateTemporaryPassword, hashPassword } from "../../auth/password";
import { staffSessions } from "../../auth/admin/sessions";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, changedKeys, idOr404, isDuplicateKey, searchPattern, sortSpec } from "./shared";

/**
 * Staff accounts and roles (prompt 7), for the platform team only (vendors have their own logins).
 *
 * Rules:
 * - Nobody can give a role, or add to a role, a permission they don't hold themselves (no self-promotion).
 * - Staff can't disable themselves or change their own role.
 * - There is always at least one active Super Admin. Every change that could remove one runs in a transaction that
 *   first bumps the Super Admin role's `guardVersion`, so two such changes at once conflict (one retries and then
 *   sees the other's result) instead of both passing the count check.
 * - Super Admin always has every permission and can't be renamed, edited or deleted. Other system roles can be
 *   edited (marked `customised`) but not renamed or deleted; custom roles can be deleted when nobody uses them.
 */

export interface StaffActor {
  staffId: string;
  permissions: readonly string[];
}

export const STAFF_LIST_SORT = ["name", "email", "lastLoginAt", "createdAt"] as const;

export interface StaffListQuery extends AdminListQuery {
  roleId?: string;
  status?: StaffStatus;
}

type LeanStaff = Omit<StaffAttrs, "sessions" | "passwordHash"> & { _id: Types.ObjectId };
type LeanRole = RoleAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "Staff member not found.", 404);
const ROLE_NOT_FOUND = () => new AppError("NOT_FOUND", "Role not found.", 404);
const VENDOR_RUN = new Set([...VENDOR_RUN_RESOURCES.flatMap((r) => [`${r}:read`, `${r}:write`]), "scan-qr:use"]);

function assertGrantable(actor: StaffActor, permissions: readonly string[], field = "roleId"): void {
  const missing = permissions.filter((p) => !actor.permissions.includes(p));
  if (missing.length === 0) return;
  throw new AppError(
    "FORBIDDEN",
    "That would give permissions you don't have yourself. Ask a Super Admin.",
    403,
    { fieldErrors: { [field]: ["Includes permissions you don't have yourself."] } },
  );
}

async function superAdminRole(): Promise<LeanRole> {
  const role = await Role.findOne({ name: SUPER_ADMIN_ROLE }).lean();
  if (!role) throw new AppError("INTERNAL", "The Super Admin role is missing. Run pnpm db:seed-roles.", 500);
  return role;
}

/**
 * Runs `change` in a transaction that refuses to leave no active Super Admin other than `targetId`'s new state.
 * `targetStillSuperAdmin` says whether the target remains an active Super Admin after the change.
 */
async function withSuperAdminGuard(
  targetId: Types.ObjectId,
  targetStillSuperAdmin: boolean,
  change: (session: ClientSession) => Promise<void>,
): Promise<void> {
  const mongoose = await connect();
  const sa = await superAdminRole();
  await mongoose.connection.transaction(async (session) => {
    await Role.updateOne({ _id: sa._id }, { $inc: { guardVersion: 1 } }, { session });
    if (!targetStillSuperAdmin) {
      const others = await Staff.countDocuments(
        { roleId: sa._id, status: "active", _id: { $ne: targetId } },
        { session },
      );
      if (others === 0) {
        throw new AppError("CONFLICT", "This is the last active Super Admin. Make someone else Super Admin first.", 409);
      }
    }
    await change(session);
  });
}

function toRow(doc: LeanStaff, roles: Map<string, string>): StaffRow {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    roleId: doc.roleId.toString(),
    roleName: roles.get(doc.roleId.toString()) ?? "No role",
    status: doc.status,
    ...(doc.lastLoginAt ? { lastLoginAt: doc.lastLoginAt.toISOString() } : {}),
    createdAt: doc.createdAt.toISOString(),
  };
}

async function roleNames(): Promise<Map<string, string>> {
  const roles = await Role.find({}, { name: 1 }).lean();
  return new Map(roles.map((r) => [r._id.toString(), r.name]));
}

// ---------------------------------------------------------------------------------------------------------------
// Staff

export async function listStaff(query: StaffListQuery): Promise<{ rows: StaffRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.roleId && /^[0-9a-f]{24}$/.test(query.roleId)) filter.roleId = query.roleId;
  if (query.q.trim()) filter.$or = [{ name: searchPattern(query.q) }, { email: searchPattern(query.q) }];
  const [docs, total, roles] = await Promise.all([
    Staff.find(filter, { sessions: 0, passwordHash: 0 })
      .sort(sortSpec(query, STAFF_LIST_SORT, "name"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Staff.countDocuments(filter),
    roleNames(),
  ]);
  return { rows: docs.map((d) => toRow(d, roles)), total };
}

export async function getStaffDetail(staffId: string, actorId: string, now: Date): Promise<StaffDetail | null> {
  const _id = idOr404(staffId, "Staff member");
  await connect();
  const [doc, roles, sa] = await Promise.all([Staff.findById(_id).lean(), roleNames(), superAdminRole()]);
  if (!doc) return null;
  const isSuperAdmin = doc.roleId.equals(sa._id) && doc.status === "active";
  const otherSuperAdmins = isSuperAdmin
    ? await Staff.countDocuments({ roleId: sa._id, status: "active", _id: { $ne: _id } })
    : 1;
  return {
    ...toRow(doc, roles),
    activeSessions: doc.sessions.filter((s) => s.expiresAt > now).length,
    isSelf: doc._id.toString() === actorId,
    isLastSuperAdmin: isSuperAdmin && otherSuperAdmins === 0,
  };
}

/** Roles for the staff form (with their permissions, so the form can say which ones the actor may assign). */
export async function listRoleOptions(actor: StaffActor): Promise<(Option & { grantable: boolean })[]> {
  await connect();
  const roles = await Role.find({}, { name: 1, permissions: 1 }).sort({ isSystem: -1, name: 1 }).lean();
  return roles.map((r) => ({
    value: r._id.toString(),
    label: r.name,
    grantable: r.permissions.every((p) => actor.permissions.includes(p)),
  }));
}

async function grantableRole(actor: StaffActor, roleId: string): Promise<LeanRole> {
  const role = await Role.findById(idOr404(roleId, "Role")).lean();
  if (!role) throw ROLE_NOT_FOUND();
  assertGrantable(actor, role.permissions);
  return role;
}

/** New staff member with a generated temporary password (returned once, never stored in clear). */
export async function createStaffByAdmin(
  actor: StaffActor,
  input: unknown,
  now: Date,
): Promise<{ id: string; name: string; email: string; temporaryPassword: string }> {
  const data = createStaffByAdminSchema.parse(input);
  await connect();
  const role = await grantableRole(actor, data.roleId);
  const temporaryPassword = generateTemporaryPassword();
  try {
    const doc = await Staff.create({
      name: data.name,
      email: data.email,
      roleId: role._id,
      passwordHash: await hashPassword(temporaryPassword),
      passwordChangedAt: now,
      status: "active",
    });
    return { id: doc.id, name: doc.name, email: doc.email, temporaryPassword };
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new AppError("CONFLICT", "A staff account with that email already exists.", 409, {
        fieldErrors: { email: ["A staff account with that email already exists."] },
      });
    }
    throw err;
  }
}

export async function updateStaffByAdmin(
  actor: StaffActor,
  staffId: string,
  input: unknown,
): Promise<{ name: string; changedFields: string[] }> {
  const _id = idOr404(staffId, "Staff member");
  const data = updateStaffSchema.parse(input);
  await connect();
  const before = await Staff.findById(_id, { name: 1, roleId: 1, status: 1 }).lean();
  if (!before) throw NOT_FOUND();
  const roleChanged = before.roleId.toString() !== data.roleId;
  if (roleChanged && staffId === actor.staffId) {
    throw new AppError("CONFLICT", "You can't change your own role. Ask another Super Admin.", 409, {
      fieldErrors: { roleId: ["You can't change your own role."] },
    });
  }
  const role = roleChanged ? await grantableRole(actor, data.roleId) : null;
  const update = { name: data.name, ...(role ? { roleId: role._id } : {}) };
  if (role) {
    const sa = await superAdminRole();
    // The target's current role must be grantable too: a manager can't demote a Super Admin they couldn't create.
    if (before.roleId.equals(sa._id)) assertGrantable(actor, sa.permissions);
    const stillSuperAdmin = !(before.roleId.equals(sa._id) && before.status === "active") || role._id.equals(sa._id);
    await withSuperAdminGuard(_id, stillSuperAdmin, async (session) => {
      await Staff.updateOne({ _id }, { $set: update }, { session });
    });
  } else {
    await Staff.updateOne({ _id }, { $set: update });
  }
  return {
    name: data.name,
    changedFields: changedKeys(
      { name: before.name, roleId: before.roleId.toString() },
      { name: data.name, roleId: data.roleId },
    ),
  };
}

/** Disable (signs them out everywhere) or enable a staff account. */
export async function setStaffStatus(
  actor: StaffActor,
  staffId: string,
  input: unknown,
): Promise<{ name: string; status: StaffStatus }> {
  const _id = idOr404(staffId, "Staff member");
  const { status } = staffStatusChangeSchema.parse(input);
  await connect();
  const before = await Staff.findById(_id, { name: 1, roleId: 1, status: 1 }).lean();
  if (!before) throw NOT_FOUND();
  if (status === "disabled" && staffId === actor.staffId) {
    throw new AppError("CONFLICT", "You can't disable your own account.", 409);
  }
  const role = await Role.findById(before.roleId, { permissions: 1 }).lean();
  assertGrantable(actor, role?.permissions ?? []);
  if (before.status === status) return { name: before.name, status };
  const sa = await superAdminRole();
  const stillSuperAdmin = status === "active" || !before.roleId.equals(sa._id);
  await withSuperAdminGuard(_id, stillSuperAdmin, async (session) => {
    await Staff.updateOne({ _id }, { $set: { status } }, { session });
  });
  if (status === "disabled") await staffSessions.revokeAllSessions(staffId);
  return { name: before.name, status };
}

// ---------------------------------------------------------------------------------------------------------------
// Roles

export async function listRoles(): Promise<RoleRow[]> {
  await connect();
  const [roles, usage] = await Promise.all([
    Role.find().sort({ isSystem: -1, name: 1 }).lean(),
    Staff.aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: "$roleId", n: { $sum: 1 } } }]),
  ]);
  const counts = new Map(usage.map((u) => [u._id.toString(), u.n]));
  return roles.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    description: r.description,
    permissions: [...r.permissions],
    isSystem: r.isSystem,
    customised: r.customised === true,
    locked: r.name === SUPER_ADMIN_ROLE,
    staff: counts.get(r._id.toString()) ?? 0,
  }));
}

export async function getRole(roleId: string): Promise<RoleRow | null> {
  const roles = await listRoles();
  return roles.find((r) => r.id === roleId) ?? null;
}

const roleNameTaken = () =>
  new AppError("CONFLICT", "Another role already has this name.", 409, {
    fieldErrors: { name: ["Another role already has this name."] },
  });

/** Vendor-run permissions grant nothing in the platform console, so roles saved here never carry them. */
const platformOnly = (permissions: string[]) => [...new Set(permissions.filter((p) => !VENDOR_RUN.has(p)))];

export async function createRole(actor: StaffActor, input: unknown): Promise<{ id: string; name: string }> {
  const data = roleSchema.parse(input);
  const permissions = platformOnly(data.permissions);
  assertGrantable(actor, permissions, "permissions");
  await connect();
  try {
    const doc = await Role.create({ ...data, permissions, isSystem: false });
    return { id: doc._id.toString(), name: doc.name };
  } catch (err) {
    if (isDuplicateKey(err)) throw roleNameTaken();
    throw err;
  }
}

export async function updateRole(
  actor: StaffActor,
  roleId: string,
  input: unknown,
): Promise<{ name: string; changedFields: string[] }> {
  const _id = idOr404(roleId, "Role");
  const data = roleSchema.parse(input);
  await connect();
  const before = await Role.findById(_id).lean();
  if (!before) throw ROLE_NOT_FOUND();
  if (before.name === SUPER_ADMIN_ROLE) {
    throw new AppError("CONFLICT", "Super Admin always has every permission and can't be edited.", 409);
  }
  if (before.isSystem && data.name !== before.name) {
    throw new AppError("CONFLICT", "System roles keep their name.", 409, {
      fieldErrors: { name: ["System roles keep their name."] },
    });
  }
  const permissions = platformOnly(data.permissions);
  assertGrantable(
    actor,
    permissions.filter((p) => !before.permissions.includes(p)),
    "permissions",
  );
  try {
    await Role.updateOne({ _id }, { $set: { name: data.name, description: data.description, permissions, customised: true } });
  } catch (err) {
    if (isDuplicateKey(err)) throw roleNameTaken();
    throw err;
  }
  return {
    name: data.name,
    changedFields: changedKeys(
      { name: before.name, description: before.description, permissions: [...before.permissions].sort() },
      { name: data.name, description: data.description, permissions: [...permissions].sort() },
    ),
  };
}

export async function deleteRole(roleId: string): Promise<{ name: string }> {
  const _id = idOr404(roleId, "Role");
  await connect();
  const role = await Role.findById(_id, { name: 1, isSystem: 1 }).lean();
  if (!role) throw ROLE_NOT_FOUND();
  if (role.isSystem) throw new AppError("CONFLICT", "System roles can't be deleted.", 409);
  const users = await Staff.countDocuments({ roleId: _id });
  if (users > 0) {
    throw new AppError(
      "CONFLICT",
      `${users} staff member${users === 1 ? " has" : "s have"} this role. Move them to another role first.`,
      409,
    );
  }
  await Role.deleteOne({ _id, isSystem: false });
  return { name: role.name };
}
