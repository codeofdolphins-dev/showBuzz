import "server-only";
import { type HydratedDocument, type Model, Schema, model, models } from "mongoose";
import { serialisationOptions } from "./transforms";

/** A staff role: a named set of "resource:action" permissions (see @showbuzz/schemas/permissions). */
export interface RoleAttrs {
  name: string;
  description: string;
  permissions: string[];
  /** One of SYSTEM_ROLES (seeded); can be edited but not deleted. */
  isSystem: boolean;
  /** Edited in the role editor: db:seed-roles then leaves its permissions alone. */
  customised?: boolean;
  /** Bumped inside staff transactions that must not run concurrently (last Super Admin guard). */
  guardVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

type RoleModel = Model<RoleAttrs>;
export type RoleDocument = HydratedDocument<RoleAttrs>;

const roleSchema = new Schema<RoleAttrs, RoleModel>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    customised: Boolean,
    guardVersion: Number,
  },
  { timestamps: true, toJSON: serialisationOptions, toObject: serialisationOptions },
);

roleSchema.index({ name: 1 }, { unique: true });

export const Role: RoleModel =
  (models.Role as RoleModel | undefined) ?? model<RoleAttrs, RoleModel>("Role", roleSchema, "roles");
