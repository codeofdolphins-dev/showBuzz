import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Banner } from "@showbuzz/db/models/Banner";
import { Event } from "@showbuzz/db/models/Event";
import { FoodItem } from "@showbuzz/db/models/FoodItem";
import { MediaAsset, type MediaAssetAttrs } from "@showbuzz/db/models/MediaAsset";
import { Movie } from "@showbuzz/db/models/Movie";
import { SitePage } from "@showbuzz/db/models/SitePage";
import { Staff } from "@showbuzz/db/models/Staff";
import { StreamTitle } from "@showbuzz/db/models/StreamTitle";
import { Types } from "@showbuzz/db/mongoose";
import { FileRejectedError, IMAGE_FILE_TYPES, getFileStorage } from "@showbuzz/db/storage/file-storage";
import { mediaAltSchema } from "@showbuzz/schemas/admin-catalog";
import type { AdminMediaRow } from "@showbuzz/schemas/types/admin-catalog";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";

/**
 * The Media Library: images staff upload once and paste into any image field (`/media/<id>`, served publicly by every
 * app). Stand-in storage: GridFS through FileStorage (JPEG/PNG/WebP, ≤ 4 MB), until S3 / Vercel Blob is chosen.
 * An image still used by a movie, event, banner, stream title, food item or website page can't be deleted.
 */

type LeanMedia = MediaAssetAttrs & { _id: Types.ObjectId };

export const mediaPath = (fileId: string) => `/media/${fileId}`;

export async function listMedia(query: {
  page: number;
  limit: number;
  q: string;
}): Promise<{ rows: AdminMediaRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ filename: pattern }, { alt: pattern }];
  }
  const [docs, total] = await Promise.all([
    MediaAsset.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanMedia[]>(),
    MediaAsset.countDocuments(filter),
  ]);
  const staff = await Staff.find(
    { _id: { $in: [...new Set(docs.map((d) => d.uploadedBy.toString()))] } },
    { name: 1 },
  ).lean();
  const names = new Map(staff.map((s) => [s._id.toString(), s.name]));
  return {
    total,
    rows: docs.map((d) => ({
      id: d.fileId.toString(),
      url: mediaPath(d.fileId.toString()),
      filename: d.filename,
      contentType: d.contentType,
      size: d.size,
      alt: d.alt,
      uploadedBy: names.get(d.uploadedBy.toString()) ?? "Staff",
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function uploadMedia(
  file: { name: string; bytes: Uint8Array },
  altInput: unknown,
  staffId: string,
): Promise<{ id: string; url: string; filename: string }> {
  const alt = mediaAltSchema.parse(altInput ?? "");
  await connect();
  let stored;
  try {
    stored = await getFileStorage().put({
      filename: file.name,
      data: file.bytes,
      owner: { ownerType: "platform", ownerId: staffId },
      allowed: IMAGE_FILE_TYPES,
    });
  } catch (err) {
    if (err instanceof FileRejectedError) {
      throw new AppError("VALIDATION_FAILED", err.message, 422, { fieldErrors: { file: [err.message] } });
    }
    throw err;
  }
  await MediaAsset.create({
    fileId: new Types.ObjectId(stored.fileId),
    filename: stored.filename,
    contentType: stored.contentType,
    size: stored.size,
    alt,
    uploadedBy: new Types.ObjectId(staffId),
  });
  return { id: stored.fileId, url: mediaPath(stored.fileId), filename: stored.filename };
}

/** Where an image path is used (human labels), so it isn't deleted from under a live page. */
export async function mediaUsage(fileId: string): Promise<string[]> {
  const path = mediaPath(fileId);
  await connect();
  const [movies, events, banners, streams, food, pages] = await Promise.all([
    Movie.find({ $or: [{ poster: path }, { backdrop: path }, { "cast.image": path }] }, { title: 1 })
      .limit(5)
      .lean(),
    Event.find({ $or: [{ poster: path }, { backdrop: path }, { "artists.image": path }] }, { title: 1 })
      .limit(5)
      .lean(),
    Banner.find({ imageUrl: path }, { title: 1 }).limit(5).lean(),
    StreamTitle.find({ poster: path }, { title: 1 }).limit(5).lean(),
    FoodItem.find({ image: path }, { name: 1 }).limit(5).lean(),
    SitePage.find({ "content.imageUrl": path }, { slug: 1 }).limit(5).lean(),
  ]);
  return [
    ...movies.map((m) => `Movie: ${m.title}`),
    ...events.map((e) => `Listing: ${e.title}`),
    ...banners.map((b) => `Banner: ${b.title}`),
    ...streams.map((s) => `Stream: ${s.title}`),
    ...food.map((f) => `Food: ${f.name}`),
    ...pages.map((p) => `Page: ${p.slug}`),
  ];
}

export async function deleteMedia(fileId: string): Promise<{ filename: string }> {
  if (!Types.ObjectId.isValid(fileId)) throw new AppError("NOT_FOUND", "Image not found.", 404);
  await connect();
  const asset = await MediaAsset.findOne({ fileId: new Types.ObjectId(fileId) }).lean();
  if (!asset) throw new AppError("NOT_FOUND", "Image not found.", 404);
  const usedBy = await mediaUsage(fileId);
  if (usedBy.length > 0) {
    throw new AppError("CONFLICT", `This image is still used (${usedBy.join("; ")}). Replace it there first.`, 409, {
      usedBy,
    });
  }
  await MediaAsset.deleteOne({ _id: asset._id });
  await getFileStorage().delete(fileId);
  return { filename: asset.filename };
}
