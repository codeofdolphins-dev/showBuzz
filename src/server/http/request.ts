import "server-only";
import { env } from "@/config/env";
import { publicEnv } from "@/config/public-env";
import { AppError } from "./app-error";

const IP_PATTERN = /^[0-9A-Fa-f:.]{2,45}$/;

/**
 * Client IP for rate limiting. On Vercel `x-forwarded-for` is set by the platform (its first hop
 * is the client); `x-real-ip` is the fallback. Anything that doesn't look like an IP is ignored.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && IP_PATTERN.test(forwarded)) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && IP_PATTERN.test(realIp)) return realIp;
  return "unknown";
}

function allowedOrigins(): Set<string> {
  const origins = new Set([publicEnv.appOrigin]);
  // Preview deployments are served from per-deployment hostnames, not NEXT_PUBLIC_APP_URL.
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (host) origins.add(`https://${host}`);
  return origins;
}

function originOf(value: string | null): string | undefined {
  if (!value || value === "null") return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF check for state-changing route handlers (Server Actions have Next's own origin check).
 * Compares Origin, falling back to Referer, against the app's origin; a request with neither is
 * rejected too.
 */
export function assertSameOrigin(request: Request): void {
  const origin = originOf(request.headers.get("origin")) ?? originOf(request.headers.get("referer"));
  if (!origin || !allowedOrigins().has(origin)) {
    throw new AppError("FORBIDDEN", "This request is not allowed.", 403);
  }
}
