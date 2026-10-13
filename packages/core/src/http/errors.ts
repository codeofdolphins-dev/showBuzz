import "server-only";
import { ZodError, z } from "zod";
import { AppError, type AppErrorCode } from "./app-error";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export interface Failure {
  status: number;
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
  /** True for anything that isn't a ZodError or AppError: log it, never show its message. */
  unexpected: boolean;
}

/** One mapping for route handlers and Server Actions, so both report the same codes and messages. */
export function toFailure(err: unknown): Failure {
  if (err instanceof ZodError) {
    const flat = z.flattenError(err);
    const fieldErrors = flat.fieldErrors as Record<string, string[]>;
    return {
      status: 422,
      code: "VALIDATION_FAILED",
      message: flat.formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? "Invalid input",
      fieldErrors,
      unexpected: false,
    };
  }
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details, unexpected: false };
  }
  return { status: 500, code: "INTERNAL", message: GENERIC_ERROR_MESSAGE, unexpected: true };
}

/** Seconds from `details.retryAfterSec`, when an error carries a usable one. */
export function retryAfterSeconds(details: Record<string, unknown> | undefined): number | undefined {
  const value = details?.retryAfterSec;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;
}
