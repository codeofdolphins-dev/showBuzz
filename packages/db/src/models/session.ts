import "server-only";
import { Schema } from "mongoose";

/**
 * One signed-in device, embedded in `users.sessions[]` and `staff.sessions[]`. Refresh tokens are stored only
 * as hashes (see docs/roadmap.md "Tokens").
 */
export interface StoredSession {
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
  /** Last "confirm it's you" check on this device; with createdAt, gates sensitive account changes. */
  reauthenticatedAt?: Date;
}

export const sessionSchema = new Schema<StoredSession>(
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
    reauthenticatedAt: Date,
  },
  { _id: false },
);
