import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";

/**
 * Console passwords (staff and vendor logins): bcrypt at cost 12. Input length is capped by newPasswordSchema
 * (72 bytes).
 */

export function hashPassword(password: string, cost: number = ADMIN_AUTH.bcryptCost): Promise<string> {
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real check when the email has no account, so response timing doesn't reveal
 * which emails have an account.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("showbuzz-timing-equaliser");
  await bcrypt.compare(password, await dummyHash);
}

/** 16 URL-safe characters (96 bits) for an admin-issued reset; meets newPasswordSchema. */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}
