import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateEnv } from "@showbuzz/runtime/revalidate-env";
import { AppError } from "./app-error";

/**
 * Server-to-server calls between the apps carry `Authorization: Bearer <REVALIDATE_SECRET>`. Both sides are hashed
 * before the constant-time compare, so neither the secret's length nor its content leaks through timing.
 */
export function internalAuthorizationHeader(): string {
  return `Bearer ${revalidateEnv.REVALIDATE_SECRET}`;
}

export function authorizeInternalRequest(request: Request): void {
  const presented = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(revalidateEnv.REVALIDATE_SECRET).digest();
  if (!presented || !timingSafeEqual(a, b)) throw new AppError("UNAUTHENTICATED", "Not authorised.", 401);
}
