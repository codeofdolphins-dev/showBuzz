import "server-only";
import { type HydratedDocument, type Model, Schema, type Types, model, models } from "mongoose";
import { AUTH } from "@/config/constants";
import type { OtpChannel, OtpPurpose } from "@/schemas/user";
import { serialisationOptions } from "./transforms";

export interface OtpChallengeAttrs {
  channel: OtpChannel;
  /** Normalised: E.164 phone or lowercase email. */
  identifier: string;
  purpose: OtpPurpose;
  /** Set for change_contact: the signed-in user adding or changing a phone/email. */
  userId?: Types.ObjectId;
  /** Name typed on the register tab, applied if verification creates the account. */
  pendingName?: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  ipPrefix?: string;
  createdAt: Date;
}

export type OtpChallengeDocument = HydratedDocument<OtpChallengeAttrs>;

/**
 * One OTP sent to a phone or email. The code itself is never stored, only its HMAC-SHA256
 * (`codeHash`, keyed with OTP_HASH_SECRET). Challenges disappear at `expiresAt` via the TTL index;
 * a used one keeps `consumedAt` until then so it can't be replayed.
 */
const otpChallengeSchema = new Schema<OtpChallengeAttrs>(
  {
    channel: { type: String, enum: ["sms", "email"], required: true },
    identifier: { type: String, required: true },
    purpose: { type: String, enum: ["sign_in", "change_contact"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    pendingName: { type: String, trim: true, minlength: 2, maxlength: 80 },
    codeHash: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: AUTH.otpMaxAttempts, min: 1 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
    ipPrefix: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: serialisationOptions,
    toObject: serialisationOptions,
  },
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Latest challenge for an identifier (verification, resend cooldown).
otpChallengeSchema.index({ identifier: 1, purpose: 1, createdAt: -1 });

otpChallengeSchema.pre("validate", function requireUserForContactChange() {
  if (this.purpose === "change_contact" && !this.userId) {
    this.invalidate("userId", "A contact change challenge needs the user it belongs to");
  }
});

export const OtpChallenge: Model<OtpChallengeAttrs> =
  models.OtpChallenge ?? model<OtpChallengeAttrs>("OtpChallenge", otpChallengeSchema, "otpChallenges");
