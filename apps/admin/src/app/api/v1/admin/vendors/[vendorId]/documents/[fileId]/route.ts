import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { getOwnKycFile } from "@showbuzz/core/services/partner/onboarding.service";
import { objectIdSchema } from "@showbuzz/schemas/common";

/**
 * Serves a vendor's KYC document to staff who may see vendors (`organisers:read`). The file must be listed on that
 * vendor's KYC and owned by it, else 404. Shown inline in the browser; never cached.
 */
export const GET = apiHandler(
  { params: z.object({ vendorId: objectIdSchema, fileId: objectIdSchema }) },
  async ({ params }) => {
    await requirePermission("organisers:read");
    const { info, data } = await getOwnKycFile(params.vendorId, params.fileId);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": info.contentType,
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `inline; filename="${info.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
