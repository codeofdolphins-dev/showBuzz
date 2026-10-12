import "server-only";
import { ZodError, z } from "zod";
import { AppError } from "./app-error";

/**
 * Server Actions return this envelope instead of throwing, so client islands can show
 * field errors and messages without an error boundary. Mirrors the REST response envelope.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

export async function runAction<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    if (err instanceof ZodError) {
      const flat = z.flattenError(err);
      const fieldErrors = flat.fieldErrors as Record<string, string[]>;
      return {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: flat.formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? "Invalid input",
          fieldErrors,
        },
      };
    }
    if (err instanceof AppError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error("Unhandled server action error", err);
    return { success: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
  }
}
