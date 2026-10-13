import "server-only";
import { AUTH } from "@showbuzz/schemas/constants";
import { User, type UserDocument } from "@showbuzz/db/models/User";
import { customerTokens } from "./jwt";
import { createSessionStore } from "./session-store";

/** Customer sessions: `users.sessions[]` with customer tokens (docs/roadmap.md "Tokens"). */

export type { SessionTokens } from "./session-store";

const customerSessions = createSessionStore<UserDocument>({
  model: User,
  tokens: customerTokens,
  maxSessions: AUTH.maxSessionsPerUser,
  label: "user",
});

export const { createSession, rotateSession, revokeSession, revokeAllSessions } = customerSessions;

/** The active user who still has live session `sid`, or null (see SessionStore.findSessionOwner). */
export const findSessionUser = customerSessions.findSessionOwner;
