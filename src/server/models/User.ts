import "server-only";
import { type HydratedDocument, type Model, Schema, model, models } from "mongoose";
import { DEFAULT_CUSTOMER_NAME } from "@/config/constants";
import { E164_INDIAN_PHONE } from "@/schemas/common";
import type { CustomerSnapshot, UserStatus } from "@/schemas/user";
import { serialisationOptions } from "./transforms";

/** One signed-in device. Refresh tokens are stored only as hashes (see docs/roadmap.md "Tokens"). */
export interface UserSession {
  sid: string;
  refreshTokenHash: string;
  /**
   * `jti` of the current refresh token. With the issue time (rotatedAt ?? createdAt) it lets the server
   * re-sign that exact token for a tab that lost a refresh race, without ever storing the token.
   */
  refreshJti: string;
  /** The token rotated out last, tolerated briefly to absorb multi-tab refresh races. */
  previousRefreshTokenHash?: string;
  rotatedAt?: Date;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  userAgent?: string;
  /** /24 (IPv4) or /48 (IPv6) prefix from ipPrefix(), never the full address. */
  ipPrefix?: string;
}

export interface UserAttrs {
  name: string;
  /** E.164, e.g. "+919876543210". */
  phone?: string;
  /** Lowercase. */
  email?: string;
  phoneVerifiedAt?: Date;
  emailVerifiedAt?: Date;
  status: UserStatus;
  lastLoginAt?: Date;
  sessions: UserSession[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserMethods {
  /** The only user shape that leaves the server. */
  toCustomerSnapshot(): CustomerSnapshot;
}

type UserModel = Model<UserAttrs, Record<string, never>, UserMethods>;
export type UserDocument = HydratedDocument<UserAttrs, UserMethods>;

const sessionSchema = new Schema<UserSession>(
  {
    sid: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    refreshJti: { type: String, required: true },
    previousRefreshTokenHash: String,
    rotatedAt: Date,
    createdAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 300 },
    ipPrefix: String,
  },
  { _id: false },
);

const userSchema = new Schema<UserAttrs, UserModel, UserMethods>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, default: DEFAULT_CUSTOMER_NAME },
    phone: { type: String, match: E164_INDIAN_PHONE },
    email: { type: String, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+$/ },
    phoneVerifiedAt: Date,
    emailVerifiedAt: Date,
    status: { type: String, enum: ["active", "blocked", "deleted"], default: "active", required: true },
    lastLoginAt: Date,
    sessions: { type: [sessionSchema], default: [] },
  },
  { timestamps: true, toJSON: serialisationOptions, toObject: serialisationOptions },
);

// Only documents that actually have the field take part, so many users can have no email (or no phone).
// $type rather than $exists so an explicit null never collides either.
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
// Not unique: users without sessions would all index the same missing value.
userSchema.index({ "sessions.sid": 1 });

userSchema.pre("validate", function requireContact() {
  // Deleted accounts are anonymised (batch 1.7) and may keep neither.
  if (this.status !== "deleted" && !this.phone && !this.email) {
    this.invalidate("phone", "A user needs a phone number or an email address");
  }
});

userSchema.method("toCustomerSnapshot", function toCustomerSnapshot(): CustomerSnapshot {
  return {
    id: this._id.toString(),
    name: this.name,
    ...(this.email ? { email: this.email } : {}),
    ...(this.phone ? { phone: this.phone } : {}),
    joinedAt: this.createdAt.toISOString(),
  };
});

export const User: UserModel =
  (models.User as UserModel | undefined) ?? model<UserAttrs, UserModel>("User", userSchema, "users");
