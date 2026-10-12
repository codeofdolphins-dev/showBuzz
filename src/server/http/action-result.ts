import "server-only";
import { log } from "@/server/log";
import { toFailure } from "./errors";

/**
 * Server Actions return this envelope instead of throwing, so client islands can show
 * field errors and messages without an error boundary. Uses the same error mapping as apiHandler.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

export async function runAction<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    const failure = toFailure(err);
    if (failure.unexpected) log.error("Unhandled server action error", { err });
    const { code, message, fieldErrors } = failure;
    return { success: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
  }
}
