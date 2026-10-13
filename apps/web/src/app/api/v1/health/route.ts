import { pingDatabase } from "@showbuzz/db/connect";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { ok } from "@showbuzz/core/http/responses";

/** Liveness for uptime monitors: 200 when the database answers, 503 when it doesn't. No internals. */
export const GET = apiHandler({}, async () => {
  const db = await pingDatabase();
  return ok({ status: db === "up" ? "ok" : "degraded", db }, undefined, { status: db === "up" ? 200 : 503 });
});
