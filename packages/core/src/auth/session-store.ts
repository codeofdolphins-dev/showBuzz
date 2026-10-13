import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Types } from "@showbuzz/db/mongoose";
import type { StoredSession } from "@showbuzz/db/models/session";
import { connect } from "@showbuzz/db/connect";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../http/app-error";
import { ipPrefix } from "../http/request";
import type { AuthRequestContext } from "./context";
import type { TokenCodec } from "./token-codec";

/**
 * Device sessions for any account model with `status` and `sessions[]` (customers: `users`, staff: `staff`).
 * Each entry holds only hashes of refresh tokens. Refresh tokens rotate on every use; presenting an old one
 * after the grace window means it was copied, so that session is revoked (docs/roadmap.md "Tokens").
 */

export interface SessionTokens {
  sid: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

interface SessionOwner {
  status: string;
  sessions: StoredSession[];
}

/** The model methods the store uses; any Mongoose model whose documents have `status` and `sessions` fits. */
export interface SessionOwnerModel<TDoc> {
  updateOne(
    filter: object,
    update: object,
    options?: object,
  ): PromiseLike<{ matchedCount: number; modifiedCount: number }>;
  findOne(filter: object): PromiseLike<TDoc | null>;
  findById(id: string, projection: object): PromiseLike<SessionOwner | null>;
}

export interface SessionStore<TDoc> {
  /** Starts a session for a signed-in account and returns its first token pair. */
  createSession(owner: { _id: Types.ObjectId }, ctx: AuthRequestContext): Promise<SessionTokens>;
  /**
   * Exchanges a refresh token for a new pair. The current token rotates; the previous one within the
   * grace window gets the session's current pair; anything older revokes the session.
   */
  rotateSession(refreshToken: string, ctx: AuthRequestContext): Promise<SessionTokens>;
  /** Signs an account out of one device. */
  revokeSession(ownerId: string, sid: string): Promise<void>;
  /** Signs an account out everywhere, optionally keeping the current device. */
  revokeAllSessions(ownerId: string, exceptSid?: string): Promise<void>;
  /**
   * The active account that still has live session `sid` (not revoked, evicted or expired), or null.
   * Access tokens can't be revoked, so callers check this before trusting one.
   */
  findSessionOwner(ownerId: string, sid: string, now: Date): Promise<TDoc | null>;
}

/** How long the token rotated out last is still accepted, to absorb multi-tab refresh races. */
const ROTATION_GRACE_MS = 10_000;

const SESSION_ENDED = "Your session has ended. Please sign in again.";

export function createSessionStore<TDoc>({
  model,
  tokens: codec,
  maxSessions,
  label,
}: {
  model: SessionOwnerModel<TDoc>;
  tokens: TokenCodec;
  maxSessions: number;
  /** Names the account kind in logs ("user", "staff"). */
  label: string;
}): SessionStore<TDoc> {
  async function createSession(owner: { _id: Types.ObjectId }, ctx: AuthRequestContext): Promise<SessionTokens> {
    const { now } = ctx;
    const ownerId = owner._id.toString();
    const sid = randomUUID();
    const jti = randomUUID();
    const tokens = await issueTokens(ownerId, sid, jti, now);

    const entry: StoredSession = {
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
    const result = await model.updateOne(
      { _id: owner._id },
      [
        {
          $set: {
            sessions: {
              $slice: [
                {
                  $sortArray: {
                    input: {
                      $concatArrays: [
                        {
                          $filter: { input: { $ifNull: ["$sessions", []] }, cond: { $gt: ["$$this.expiresAt", now] } },
                        },
                        { $literal: [entry] },
                      ],
                    },
                    sortBy: { lastUsedAt: 1 },
                  },
                },
                -maxSessions,
              ],
            },
          },
        },
      ],
      { updatePipeline: true },
    );
    if (result.matchedCount !== 1) throw new Error(`Cannot create a session for a missing ${label}`);
    return tokens;
  }

  async function rotateSession(refreshToken: string, ctx: AuthRequestContext): Promise<SessionTokens> {
    const { now } = ctx;
    const verified = await codec.verifyRefreshToken(refreshToken, now);
    if (!verified.ok) throw sessionEnded();
    const { sub: ownerId, sid } = verified.claims;
    const presentedHash = sha256(refreshToken);

    await connect();
    const session = await activeSession(ownerId, sid, now);
    if (!session) throw sessionEnded();

    if (hashesMatch(session.refreshTokenHash, presentedHash)) {
      const jti = randomUUID();
      const tokens = await issueTokens(ownerId, sid, jti, now);
      // Conditional on the old hash: of two concurrent rotations with the same token, only one applies.
      const rotated = await model.updateOne(
        { _id: ownerId, status: "active", sessions: { $elemMatch: { sid, refreshTokenHash: presentedHash } } },
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
        await purgeExpiredSessions(ownerId, now);
        return tokens;
      }
      // Another request rotated this token first: answer like any other request inside the grace window.
    }

    return graceOrRevoke(ownerId, sid, presentedHash, now);
  }

  async function revokeSession(ownerId: string, sid: string): Promise<void> {
    await connect();
    await model.updateOne({ _id: ownerId }, { $pull: { sessions: { sid } } });
  }

  async function revokeAllSessions(ownerId: string, exceptSid?: string): Promise<void> {
    await connect();
    await model.updateOne(
      { _id: ownerId },
      exceptSid ? { $pull: { sessions: { sid: { $ne: exceptSid } } } } : { $set: { sessions: [] } },
    );
  }

  /** The previous token, re-presented: a race (inside the grace window) or a stolen copy (after it). */
  async function graceOrRevoke(ownerId: string, sid: string, presentedHash: string, now: Date): Promise<SessionTokens> {
    const session = await activeSession(ownerId, sid, now);
    if (!session) throw sessionEnded();

    const isPrevious =
      !!session.previousRefreshTokenHash && hashesMatch(session.previousRefreshTokenHash, presentedHash);
    const withinGrace = !!session.rotatedAt && now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;

    if (isPrevious && withinGrace && session.rotatedAt) {
      // Re-sign the session's current refresh token (deterministic) so every tab ends with the same pair.
      const refresh = await codec.signRefreshToken({
        sub: ownerId,
        sid,
        jti: session.refreshJti,
        issuedAt: session.rotatedAt,
      });
      if (hashesMatch(session.refreshTokenHash, sha256(refresh.token))) {
        const access = await codec.signAccessToken({ sub: ownerId, sid, issuedAt: now });
        return {
          sid,
          accessToken: access.token,
          accessExpiresAt: access.expiresAt,
          refreshToken: refresh.token,
          refreshExpiresAt: refresh.expiresAt,
        };
      }
    }

    await revokeSession(ownerId, sid);
    // Token values are never logged; the ids are enough to investigate. `userId` keeps the customer log shape.
    log.warn("Refresh token reuse detected; session revoked", {
      event: "auth.refresh_reuse",
      account: label,
      userId: ownerId,
      sid,
    });
    throw sessionEnded();
  }

  async function findSessionOwner(ownerId: string, sid: string, now: Date): Promise<TDoc | null> {
    if (!isObjectId(ownerId)) return null;
    await connect();
    return model.findOne({
      _id: ownerId,
      status: "active",
      sessions: { $elemMatch: { sid, expiresAt: { $gt: now } } },
    });
  }

  /** The account's live session `sid`, or undefined when the account, the session or its status isn't usable. */
  async function activeSession(ownerId: string, sid: string, now: Date): Promise<StoredSession | undefined> {
    if (!isObjectId(ownerId)) return undefined;
    const owner = await model.findById(ownerId, { status: 1, sessions: 1 });
    if (!owner || owner.status !== "active") return undefined;
    return owner.sessions.find((s) => s.sid === sid && s.expiresAt > now);
  }

  async function purgeExpiredSessions(ownerId: string, now: Date): Promise<void> {
    await model.updateOne({ _id: ownerId }, { $pull: { sessions: { expiresAt: { $lte: now } } } });
  }

  async function issueTokens(ownerId: string, sid: string, jti: string, now: Date): Promise<SessionTokens> {
    const [access, refresh] = await Promise.all([
      codec.signAccessToken({ sub: ownerId, sid, issuedAt: now }),
      codec.signRefreshToken({ sub: ownerId, sid, jti, issuedAt: now }),
    ]);
    return {
      sid,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  return { createSession, rotateSession, revokeSession, revokeAllSessions, findSessionOwner };
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
