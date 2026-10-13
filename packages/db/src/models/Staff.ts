import "server-only";
import { type HydratedDocument, type Model, Schema, type Types, model, models } from "mongoose";
import type { StaffStatus } from "@showbuzz/schemas/staff";
import { sessionSchema, type StoredSession } from "./session";
import { serialisationOptions } from "./transforms";

/** An admin console account (operators, managers, finance, support). Customers live in `users`. */
export interface StaffAttrs {
  name: string;
  /** Lowercase, unique. */
  email: string;
  /** bcrypt (cost ADMIN_AUTH.bcryptCost). Never serialised (transforms drop every *Hash field). */
  passwordHash: string;
  roleId: Types.ObjectId;
  status: StaffStatus;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  sessions: StoredSession[];
  createdAt: Date;
  updatedAt: Date;
}

type StaffModel = Model<StaffAttrs>;
export type StaffDocument = HydratedDocument<StaffAttrs>;

const staffSchema = new Schema<StaffAttrs, StaffModel>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+$/ },
    passwordHash: { type: String, required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active", required: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    sessions: { type: [sessionSchema], default: [] },
  },
  { timestamps: true, toJSON: serialisationOptions, toObject: serialisationOptions },
);

staffSchema.index({ email: 1 }, { unique: true });
staffSchema.index({ "sessions.sid": 1 });
staffSchema.index({ roleId: 1 });

export const Staff: StaffModel =
  (models.Staff as StaffModel | undefined) ?? model<StaffAttrs, StaffModel>("Staff", staffSchema, "staff");
