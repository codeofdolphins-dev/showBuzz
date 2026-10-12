import "server-only";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import type { z } from "zod";
import { log } from "@/server/log";
import { AppError } from "./app-error";
import { retryAfterSeconds, toFailure } from "./errors";
import { fail } from "./responses";

type Schema = z.ZodType | undefined;
type Parsed<S extends Schema> = S extends z.ZodType ? z.output<S> : undefined;

export interface ApiHandlerOptions<B extends Schema, Q extends Schema, P extends Schema> {
  body?: B;
  query?: Q;
  params?: P;
  /**
   * Opt into caching by giving the Cache-Control value to send. Without it the response is
   * `no-store` and the handler only runs for a real request (never while `next build` prerenders).
   */
  cacheControl?: string;
}

export interface ApiContext<B extends Schema, Q extends Schema, P extends Schema> {
  request: Request;
  requestId: string;
  body: Parsed<B>;
  query: Parsed<Q>;
  params: Parsed<P>;
}

/** Next passes route params as a promise; routes without dynamic segments get an empty object. */
interface RouteContext {
  params?: Promise<unknown>;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Wraps a route handler: validates body/query/params with Zod, maps errors to the response
 * envelope (ZodError → 422, AppError → its status, anything else → 500 with a generic message),
 * and sets `x-request-id` and `Cache-Control` on every response.
 */
export function apiHandler<B extends Schema = undefined, Q extends Schema = undefined, P extends Schema = undefined>(
  options: ApiHandlerOptions<B, Q, P>,
  handler: (ctx: ApiContext<B, Q, P>) => Response | Promise<Response>,
) {
  return async function route(request: Request, context?: RouteContext): Promise<Response> {
    const incomingId = request.headers.get("x-request-id");
    const requestId = incomingId && REQUEST_ID_PATTERN.test(incomingId) ? incomingId : randomUUID();

    let response: Response;
    try {
      if (options.cacheControl === undefined) await connection();
      const body = options.body ? options.body.parse(await readJsonBody(request)) : undefined;
      const query = options.query
        ? options.query.parse(searchParamsToObject(new URL(request.url).searchParams))
        : undefined;
      const params = options.params ? options.params.parse((await context?.params) ?? {}) : undefined;
      response = await handler({
        request,
        requestId,
        body: body as Parsed<B>,
        query: query as Parsed<Q>,
        params: params as Parsed<P>,
      });
    } catch (err) {
      const failure = toFailure(err);
      if (failure.unexpected) {
        log.error("Unhandled API error", {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          err,
        });
      }
      const details = failure.fieldErrors ? { ...failure.details, fieldErrors: failure.fieldErrors } : failure.details;
      response = fail({ status: failure.status, code: failure.code, message: failure.message, details });
      const retryAfter = retryAfterSeconds(failure.details);
      if (retryAfter !== undefined) response.headers.set("Retry-After", String(retryAfter));
    }

    response.headers.set("x-request-id", requestId);
    response.headers.set("Cache-Control", options.cacheControl ?? "no-store");
    return response;
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", "Request body must be valid JSON.", 422);
  }
}

/** Repeated keys (`?tag=a&tag=b`) become arrays; single keys stay strings. */
function searchParamsToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    out[key] = values.length === 1 ? (values[0] ?? "") : values;
  }
  return out;
}
