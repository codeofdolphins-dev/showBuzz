import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isProduction } from "@showbuzz/runtime/env";

/**
 * Seat holds belong to the browser, not the account: seats are picked before sign-in (sign-in is only required
 * before payment), so the first hold sets a random token in an httpOnly cookie and holds store its SHA-256.
 * Signing in never touches this cookie, so holds carry through sign-in with no merge step. Placing an order
 * needs both a signed-in customer and holds that match this cookie.
 */

const HOLD_COOKIE = isProduction ? "__Host-sb_hold" : "sb_hold";
const HOLD_COOKIE_MAX_AGE_SEC = 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toHolderKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The current browser's holder key, or undefined if it has never held a seat. Readable while rendering. */
export async function readHolderKey(): Promise<string | undefined> {
  const token = (await cookies()).get(HOLD_COOKIE)?.value;
  return token && TOKEN_PATTERN.test(token) ? toHolderKey(token) : undefined;
}

/** The holder key, creating the cookie first if needed. Server Actions and route handlers only (sets a cookie). */
export async function getOrCreateHolderKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(HOLD_COOKIE)?.value;
  if (existing && TOKEN_PATTERN.test(existing)) return toHolderKey(existing);

  const token = randomBytes(32).toString("base64url");
  store.set(HOLD_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: HOLD_COOKIE_MAX_AGE_SEC,
  });
  return toHolderKey(token);
}
