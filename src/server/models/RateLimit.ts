import "server-only";
import { type InferSchemaType, type Model, Schema, model, models } from "mongoose";

/** One fixed-window counter per (hashed) key. Expired windows are removed by the TTL index. */
const rateLimitSchema = new Schema(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// The unique index is what makes concurrent upserts converge on one counter per window.
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;

export const RateLimit: Model<RateLimitDoc> =
  models.RateLimit ?? model<RateLimitDoc>("RateLimit", rateLimitSchema, "rateLimits");
