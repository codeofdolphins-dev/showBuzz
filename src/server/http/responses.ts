import "server-only";
import { NextResponse } from "next/server";

/**
 * Response envelope from CLAUDE.md §7. Lists pass `meta: { page, limit, total }`. Returns NextResponse
 * so handlers can set cookies on it (`response.cookies`).
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponseBody<T> =
  { success: true; data: T; meta?: Record<string, unknown> } | { success: false; error: ApiError };

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit): NextResponse {
  const body: ApiResponseBody<T> = meta === undefined ? { success: true, data } : { success: true, data, meta };
  return NextResponse.json(body, init);
}

/** Accepts an AppError directly, or any `{ status, code, message, details? }`. */
export function fail(error: ApiError & { status: number }, init?: ResponseInit): NextResponse {
  const { code, message, details } = error;
  const body: ApiResponseBody<never> = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { ...init, status: init?.status ?? error.status });
}
