import { z } from "zod";
import { authorizeInternalRequest } from "@showbuzz/core/http/internal-auth";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { ok } from "@showbuzz/core/http/responses";
import { CATALOG_TAGS, revalidateCatalog } from "@showbuzz/core/services/catalog.service";
import { log } from "@showbuzz/runtime/log";

const catalogTagSchema = z.enum(Object.values(CATALOG_TAGS) as [string, ...string[]]);
const bodySchema = z.object({ tags: z.array(catalogTagSchema).min(1).max(20) });

/**
 * Server-to-server cache refresh for the consoles (revalidateWeb in @showbuzz/core): marks the given catalogue tags
 * stale. Protected by REVALIDATE_SECRET (Bearer token, constant-time compare); no cookies, so no origin check.
 */
export const POST = apiHandler({ body: bodySchema }, async ({ request, body }) => {
  authorizeInternalRequest(request);
  const tags = [...new Set(body.tags)] as (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS][];
  for (const tag of tags) revalidateCatalog(tag);
  log.info("Catalogue revalidated", { event: "web.revalidate", tags });
  return ok({ revalidated: tags });
});
