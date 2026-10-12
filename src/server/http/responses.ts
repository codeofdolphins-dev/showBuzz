import "server-only";

/** Response envelope from CLAUDE.md §7. Lists pass `meta: { page, limit, total }`. */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponseBody<T> =
  { success: true; data: T; meta?: Record<string, unknown> } | { success: false; error: ApiError };

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit): Response {
  const body: ApiResponseBody<T> = meta === undefined ? { success: true, data } : { success: true, data, meta };
  return Response.json(body, init);
}

/** Accepts an AppError directly, or any `{ status, code, message, details? }`. */
export function fail(error: ApiError & { status: number }, init?: ResponseInit): Response {
  const { code, message, details } = error;
  const body: ApiResponseBody<never> = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return Response.json(body, { ...init, status: init?.status ?? error.status });
}
