import "server-only";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../http/app-error";
import { consumeRateLimit } from "../security/rate-limit";
import type { AuthRequestContext } from "./context";
import { burnPasswordCheck, verifyPassword } from "./password";

/**
 * Email + password checks shared by the console logins (staff, vendor users). One message for an unknown email, a
 * wrong password and a disabled account, a dummy bcrypt compare for unknown emails (no timing difference), and
 * per-email and per-IP attempt limits.
 */

export interface PasswordAccount {
  id: string;
  passwordHash: string;
  status: string;
}

export interface PasswordSignInOptions<T extends PasswordAccount> {
  email: string;
  password: string;
  ctx: AuthRequestContext;
  /** Rate-limit key prefix and log label, e.g. "staff" or "vendor-user". */
  label: string;
  limits: { windowSec: number; maxPerEmail: number; maxPerIp: number };
  findAccount: (email: string) => Promise<T | null>;
}

export const INVALID_CREDENTIALS = "Invalid email or password.";

/** The active account for these credentials, or 401 / 429. */
export async function checkPasswordSignIn<T extends PasswordAccount>(options: PasswordSignInOptions<T>): Promise<T> {
  const { email, password, ctx, label, limits } = options;
  await limitLogin(`${label}-login:email:${email}`, limits.maxPerEmail, limits.windowSec, ctx.now);
  if (ctx.ip !== "unknown") await limitLogin(`${label}-login:ip:${ctx.ip}`, limits.maxPerIp, limits.windowSec, ctx.now);

  const account = await options.findAccount(email);
  if (!account) {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
  // The password is checked before the status, so a disabled account answers exactly like a wrong password.
  const passwordOk = await verifyPassword(password, account.passwordHash);
  if (!passwordOk || account.status !== "active") {
    if (passwordOk) {
      log.info("Disabled account tried to sign in", { event: `${label}.login_disabled`, accountId: account.id });
    }
    throw invalidCredentials();
  }
  return account;
}

async function limitLogin(key: string, limit: number, windowSec: number, now: Date): Promise<void> {
  const result = await consumeRateLimit(key, { limit, windowSec, now });
  if (result.allowed) return;
  const minutes = Math.max(1, Math.ceil(result.retryAfterSec / 60));
  throw new AppError(
    "RATE_LIMITED",
    `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    429,
    { retryAfterSec: result.retryAfterSec },
  );
}

function invalidCredentials() {
  return new AppError("UNAUTHENTICATED", INVALID_CREDENTIALS, 401);
}
