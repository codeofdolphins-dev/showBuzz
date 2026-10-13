import "server-only";
import { log } from "@showbuzz/runtime/log";
import { toFailure } from "./errors";

/**
 * Server Actions return this envelope instead of throwing, so client islands can show
 * field errors and messages without an error boundary. Uses the same error mapping as apiHandler;
 * `details` is the AppError's client-safe data (e.g. remainingAttempts, retryAfterSec).
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        fieldErrors?: Record<string, string[]>;
      };
    };

export async function runAction<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    const failure = toFailure(err);
    if (failure.unexpected) log.error("Unhandled server action error", { err });
    const { code, message, details, fieldErrors } = failure;
    return {
      success: false,
      error: { code, message, ...(details ? { details } : {}), ...(fieldErrors ? { fieldErrors } : {}) },
    };
  }
}
