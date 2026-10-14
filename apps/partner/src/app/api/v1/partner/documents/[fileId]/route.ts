import { z } from "zod";
import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { getOwnKycFile } from "@showbuzz/core/services/partner/onboarding.service";
import { objectIdSchema } from "@showbuzz/schemas/common";

/**
 * Serves one of the signed-in vendor's own KYC documents (private files: another vendor's file answers 404 like a
 * missing one). Shown inline in the browser; never cached.
 */
export const GET = apiHandler({ params: z.object({ fileId: objectIdSchema }) }, async ({ params }) => {
  const { vendor } = await requireVendor();
  const { info, data } = await getOwnKycFile(vendor.id, params.fileId);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": info.contentType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `inline; filename="${info.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
