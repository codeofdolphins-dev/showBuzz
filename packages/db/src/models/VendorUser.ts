import "server-only";
import { type HydratedDocument, type Model, Schema, type Types, model, models } from "mongoose";
import { sessionSchema, type StoredSession } from "./session";
import { serialisationOptions } from "./transforms";

/**
 * A partner-portal login (partner.showbuzz.com). One per vendor for now ("owner"); the role field is there so
 * vendor team roles can be added later without a migration.
 */
export interface VendorUserAttrs {
  vendorId: Types.ObjectId;
  name: string;
  /** Lowercase, unique across all vendors. */
  email: string;
  /** bcrypt. Never serialised (transforms drop every *Hash field). */
  passwordHash: string;
  role: "owner";
  status: "active" | "disabled";
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  sessions: StoredSession[];
  createdAt: Date;
  updatedAt: Date;
}

type VendorUserModel = Model<VendorUserAttrs>;
export type VendorUserDocument = HydratedDocument<VendorUserAttrs>;

const vendorUserSchema = new Schema<VendorUserAttrs, VendorUserModel>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+$/ },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["owner"], default: "owner", required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active", required: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    sessions: { type: [sessionSchema], default: [] },
  },
  { timestamps: true, toJSON: serialisationOptions, toObject: serialisationOptions },
);

vendorUserSchema.index({ email: 1 }, { unique: true });
vendorUserSchema.index({ vendorId: 1 });
vendorUserSchema.index({ "sessions.sid": 1 });

export const VendorUser: VendorUserModel =
  (models.VendorUser as VendorUserModel | undefined) ??
  model<VendorUserAttrs, VendorUserModel>("VendorUser", vendorUserSchema, "vendorUsers");
