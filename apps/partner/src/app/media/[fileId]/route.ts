import { connection } from "next/server";
import { z } from "zod";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { getPublicMedia, mediaResponse } from "@showbuzz/core/services/media.service";
import { objectIdSchema } from "@showbuzz/schemas/common";

/**
 * A Media Library image (`/media/<id>`, the path stored in image fields). Public and immutable; only Media Library
 * files are served (never KYC documents). The consoles serve it too, so previews of `/media/...` paths work on every host.
 */
export const GET = apiHandler(
  { params: z.object({ fileId: objectIdSchema }), cacheControl: "public, max-age=31536000, immutable" },
  async ({ params }) => {
    // Never prerendered: the file is read per request (then cached by browsers and the CDN).
    await connection();
    return mediaResponse(await getPublicMedia(params.fileId));
  },
);
