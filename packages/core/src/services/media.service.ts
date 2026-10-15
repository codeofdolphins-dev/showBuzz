import "server-only";
import { getFileStorage } from "@showbuzz/db/storage/file-storage";
import { AppError } from "../http/app-error";

/**
 * Public Media Library images for the `/media/<id>` route of every app. Only files the Media Library stored
 * (`ownerType: "platform"`) are served: a KYC document id answers 404 exactly like a missing file.
 */
export async function getPublicMedia(fileId: string) {
  const file = await getFileStorage().get(fileId);
  if (!file || file.info.owner.ownerType !== "platform" || !file.info.contentType.startsWith("image/")) {
    throw new AppError("NOT_FOUND", "Image not found.", 404);
  }
  return file;
}

/** The route handler's response: immutable (a file never changes under its id), never sniffed as anything else. */
export function mediaResponse(file: Awaited<ReturnType<typeof getPublicMedia>>): Response {
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.info.contentType,
      "Content-Length": String(file.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
