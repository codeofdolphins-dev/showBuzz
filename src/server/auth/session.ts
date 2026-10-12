import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Types } from "mongoose";
import { AUTH } from "@/config/constants";
import { connect } from "@/server/db/connect";
import { AppError } from "@/server/http/app-error";
import { ipPrefix } from "@/server/http/request";
import { log } from "@/server/log";
import { User, type UserDocument, type UserSession } from "@/server/models/User";
import type { AuthRequestContext } from "./context";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";

/**
 * Customer sessions: one entry per signed-in device on the user document, holding only hashes of
 * refresh tokens. Refresh tokens rotate on every use; presenting an old one after the grace window
 * means it was copied, so that session is revoked (docs/roadmap.md "Tokens").
 */

export interface SessionTokens {
  sid: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** How long the token rotated out last is still accepted, to absorb multi-tab refresh races. */
const ROTATION_GRACE_MS = 10_000;

const SESSION_ENDED = "Your session has ended. Please sign in again.";

/** Starts a session for a signed-in user and returns its first token pair. */
export async function createSession(user: { _id: Types.ObjectId }, ctx: AuthRequestContext): Promise<SessionTokens> {
  const { now } = ctx;
  const userId = user._id.toString();
  const sid = randomUUID();
  const jti = randomUUID();
  const tokens = await issueTokens(userId, sid, jti, now);

  const entry: UserSession = {
    sid,
    refreshTokenHash: sha256(tokens.refreshToken),
    refreshJti: jti,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: tokens.refreshExpiresAt,
    ...(ctx.userAgent ? { userAgent: ctx.userAgent.slice(0, 300) } : {}),
    ...(ipPrefix(ctx.ip) ? { ipPrefix: ipPrefix(ctx.ip) } : {}),
  };

  await connect();
  // One atomic update: drop expired sessions, add this one, keep the most recently used ones.
  const result = await User.updateOne(
    { _id: user._id },
    [
      {
        $set: {
          sessions: {
            $slice: [
              {
                $sortArray: {
                  input: {
                    $concatArrays: [
                      { $filter: { input: { $ifNull: ["$sessions", []] }, cond: { $gt: ["$$this.expiresAt", now] } } },
                      { $literal: [entry] },
                    ],
                  },
                  sortBy: { lastUsedAt: 1 },
                },
              },
              -AUTH.maxSessionsPerUser,
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
  if (result.matchedCount !== 1) throw new Error("Cannot create a session for a missing user");
  return tokens;
}

/**
 * Exchanges a refresh token for a new pair. The current token rotates; the previous one within the
 * grace window gets the session's current pair; anything older revokes the session.
 */
export async function rotateSession(refreshToken: string, ctx: AuthRequestContext): Promise<SessionTokens> {
  const { now } = ctx;
  const verified = await verifyRefreshToken(refreshToken, now);
  if (!verified.ok) throw sessionEnded();
  const { sub: userId, sid } = verified.claims;
  const presentedHash = sha256(refreshToken);

  await connect();
  const session = await activeSession(userId, sid, now);
  if (!session) throw sessionEnded();

  if (hashesMatch(session.refreshTokenHash, presentedHash)) {
    const jti = randomUUID();
    const tokens = await issueTokens(userId, sid, jti, now);
    // Conditional on the old hash: of two concurrent rotations with the same token, only one applies.
    const rotated = await User.updateOne(
      { _id: userId, status: "active", sessions: { $elemMatch: { sid, refreshTokenHash: presentedHash } } },
      {
        $set: {
          "sessions.$.refreshTokenHash": sha256(tokens.refreshToken),
          "sessions.$.refreshJti": jti,
          "sessions.$.previousRefreshTokenHash": presentedHash,
          "sessions.$.rotatedAt": now,
          "sessions.$.lastUsedAt": now,
          "sessions.$.expiresAt": tokens.refreshExpiresAt,
        },
      },
    );
    if (rotated.modifiedCount === 1) {
      await purgeExpiredSessions(userId, now);
      return tokens;
    }
    // Another request rotated this token first: answer like any other request inside the grace window.
  }

  return graceOrRevoke(userId, sid, presentedHash, now);
}

/** Signs a user out of one device. */
export async function revokeSession(userId: string, sid: string): Promise<void> {
  await connect();
  await User.updateOne({ _id: userId }, { $pull: { sessions: { sid } } });
}

/** Signs a user out everywhere, optionally keeping the current device. */
export async function revokeAllSessions(userId: string, exceptSid?: string): Promise<void> {
  await connect();
  await User.updateOne(
    { _id: userId },
    exceptSid ? { $pull: { sessions: { sid: { $ne: exceptSid } } } } : { $set: { sessions: [] } },
  );
}

/** The previous token, re-presented: a race (inside the grace window) or a stolen copy (after it). */
async function graceOrRevoke(userId: string, sid: string, presentedHash: string, now: Date): Promise<SessionTokens> {
  const session = await activeSession(userId, sid, now);
  if (!session) throw sessionEnded();

  const isPrevious = !!session.previousRefreshTokenHash && hashesMatch(session.previousRefreshTokenHash, presentedHash);
  const withinGrace = !!session.rotatedAt && now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;

  if (isPrevious && withinGrace && session.rotatedAt) {
    // Re-sign the session's current refresh token (deterministic) so every tab ends with the same pair.
    const refresh = await signRefreshToken({ sub: userId, sid, jti: session.refreshJti, issuedAt: session.rotatedAt });
    if (hashesMatch(session.refreshTokenHash, sha256(refresh.token))) {
      const access = await signAccessToken({ sub: userId, sid, issuedAt: now });
      return {
        sid,
        accessToken: access.token,
        accessExpiresAt: access.expiresAt,
        refreshToken: refresh.token,
        refreshExpiresAt: refresh.expiresAt,
      };
    }
  }

  await revokeSession(userId, sid);
  // Token values are never logged; the ids are enough to investigate.
  log.warn("Refresh token reuse detected; session revoked", { event: "auth.refresh_reuse", userId, sid });
  throw sessionEnded();
}

/**
 * The active user who still has live session `sid` (it hasn't been revoked, evicted or expired), or
 * null. Access tokens can't be revoked, so callers check this before trusting one.
 */
export async function findSessionUser(userId: string, sid: string, now: Date): Promise<UserDocument | null> {
  if (!isObjectId(userId)) return null;
  await connect();
  const user = await User.findOne({
    _id: userId,
    status: "active",
    sessions: { $elemMatch: { sid, expiresAt: { $gt: now } } },
  });
  return user;
}

/** The user's live session `sid`, or undefined when the user, the session or the account isn't usable. */
async function activeSession(userId: string, sid: string, now: Date): Promise<UserSession | undefined> {
  if (!isObjectId(userId)) return undefined;
  const user = await User.findById(userId, { status: 1, sessions: 1 });
  if (!user || user.status !== "active") return undefined;
  return user.sessions.find((s) => s.sid === sid && s.expiresAt > now);
}

async function purgeExpiredSessions(userId: string, now: Date): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { sessions: { expiresAt: { $lte: now } } } });
}

async function issueTokens(userId: string, sid: string, jti: string, now: Date): Promise<SessionTokens> {
  const [access, refresh] = await Promise.all([
    signAccessToken({ sub: userId, sid, issuedAt: now }),
    signRefreshToken({ sub: userId, sid, jti, issuedAt: now }),
  ]);
  return {
    sid,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

function isObjectId(value: string): boolean {
  return /^[0-9a-f]{24}$/.test(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashesMatch(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionEnded() {
  return new AppError("UNAUTHENTICATED", SESSION_ENDED, 401);
}
