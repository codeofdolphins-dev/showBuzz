import { z } from "zod";
import { makeEmailSchema, objectIdSchema, personNameSchema } from "./common";
import { permissionSchema } from "./permissions";

export const staffStatusSchema = z.enum(["active", "disabled"]);
export type StaffStatus = z.infer<typeof staffStatusSchema>;

export const staffEmailSchema = makeEmailSchema("Enter a valid email address").pipe(z.string().max(254));

/** bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated. */
const BCRYPT_MAX_BYTES = 72;

/** Policy for new passwords (login accepts whatever was set, so a stricter policy never locks anyone out). */
export const newPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .refine((value) => new TextEncoder().encode(value).length <= BCRYPT_MAX_BYTES, "Use at most 72 bytes")
  .refine((value) => value.trim() === value, "Remove spaces at the start or end");

export const staffLoginSchema = z.object({
  email: staffEmailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: newPasswordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password different from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Super Admin sets a temporary password for another staff member (stand-in until an email provider exists). */
export const resetStaffPasswordSchema = z.object({ email: staffEmailSchema });
export type ResetStaffPasswordInput = z.infer<typeof resetStaffPasswordSchema>;

export const newStaffSchema = z.object({
  name: personNameSchema,
  email: staffEmailSchema,
  password: newPasswordSchema,
  roleId: objectIdSchema,
});
export type NewStaffInput = z.infer<typeof newStaffSchema>;

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  permissions: z.array(permissionSchema).max(200),
});
export type RoleInput = z.infer<typeof roleSchema>;

/** What the browser may know about the signed-in staff member. Never includes sessions or hashes. */
export const staffSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.object({ id: z.string(), name: z.string() }),
  permissions: z.array(z.string()),
  lastLoginAt: z.iso.datetime().optional(),
});
export type StaffSnapshot = z.infer<typeof staffSnapshotSchema>;

/** Staff created from /users: the password is generated on the server and shown once. */
export const createStaffByAdminSchema = z.object({
  name: personNameSchema,
  email: staffEmailSchema,
  roleId: objectIdSchema.or(z.literal("")).refine((v) => v !== "", "Choose a role"),
});
export type CreateStaffByAdminInput = z.infer<typeof createStaffByAdminSchema>;

export const updateStaffSchema = z.object({
  name: personNameSchema,
  roleId: objectIdSchema.or(z.literal("")).refine((v) => v !== "", "Choose a role"),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const staffStatusChangeSchema = z.object({ status: staffStatusSchema });

export const STAFF_SORT_FIELDS = ["name", "email", "lastLoginAt", "createdAt"] as const;
