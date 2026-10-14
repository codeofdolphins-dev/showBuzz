import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { changePasswordSchema } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../http/app-error";
import { consumeRateLimit } from "../security/rate-limit";
import { hashPassword, verifyPassword } from "./password";
import type { SessionStore } from "./session-store";

/** The model methods a password change needs (Staff and VendorUser both fit). */
export interface PasswordOwnerModel {
  findById(id: string): PromiseLike<{ _id: unknown; passwordHash: string; status: string } | null>;
  updateOne(filter: object, update: object): PromiseLike<unknown>;
}

/**
 * Changes a console login's own password (staff, vendor user). Needs the current password (rate-limited like
 * sign-in); signs out every other device and keeps this one.
 */
export async function changeAccountPassword(
  options: {
    model: PasswordOwnerModel;
    sessions: Pick<SessionStore<unknown>, "revokeAllSessions">;
    /** Rate-limit key prefix and log label: "staff", "vendor-user". */
    label: string;
    accountId: string;
    sid: string;
  },
  input: unknown,
  now = new Date(),
): Promise<void> {
  const { model, sessions, label, accountId, sid } = options;
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const limit = await consumeRateLimit(`${label}-password:${accountId}`, {
    limit: ADMIN_AUTH.passwordChangeMaxPerWindow,
    windowSec: ADMIN_AUTH.loginWindowSec,
    now,
  });
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  await connect();
  const account = await model.findById(accountId);
  if (!account || account.status !== "active")
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  if (!(await verifyPassword(currentPassword, account.passwordHash))) {
    throw new AppError("VALIDATION_FAILED", "Your current password is incorrect.", 422, {
      fieldErrors: { currentPassword: ["Your current password is incorrect."] },
    });
  }

  await model.updateOne(
    { _id: account._id },
    { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: now } },
  );
  await sessions.revokeAllSessions(accountId, sid);
  log.info("Password changed", { event: `${label}.password_changed`, accountId });
}
