"use server";

import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { AppError } from "@showbuzz/core/http/app-error";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import { topUpDemoShows } from "@showbuzz/core/services/admin/backup.service";
import { restoreListing, takeDownListing } from "@showbuzz/core/services/admin/listing-admin.service";
import { deleteMedia, uploadMedia } from "@showbuzz/core/services/admin/media-admin.service";
import { createStream, moveStream, updateStream } from "@showbuzz/core/services/admin/stream-admin.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { actorOf } from "@/lib/actor";

/** Listing takedowns, online stream titles, the Media Library and the demo show top-up (admin batch 9). */

const kindSchema = z.enum(["event", "play", "sport", "activity"]);

// Listings ----------------------------------------------------------------------------------------------------------

export async function takeDownListingAction(
  kind: unknown,
  id: unknown,
  input: unknown,
): Promise<ActionResult<{ title: string }>> {
  return runAction(async () => {
    const k = kindSchema.parse(kind);
    const current = await requirePermission(`${LISTING_SECTIONS[k].resource}:write`);
    const listingId = objectIdSchema.parse(id);
    const { title, vendorId } = await takeDownListing(k, listingId, input, current.staff.id, new Date());
    revalidateWeb([CATALOG_TAGS.events, CATALOG_TAGS.shows]);
    await logActivity(actorOf(current, vendorId), {
      action: "listing_takedown",
      resource: "event",
      resourceId: listingId,
      summary: `Took down ${LISTING_SECTIONS[k].one.toLowerCase()} ${title}`,
      changedFields: ["takenDownAt", "takedownReason"],
    });
    return { title };
  });
}

export async function restoreListingAction(kind: unknown, id: unknown): Promise<ActionResult<{ title: string }>> {
  return runAction(async () => {
    const k = kindSchema.parse(kind);
    const current = await requirePermission(`${LISTING_SECTIONS[k].resource}:write`);
    const listingId = objectIdSchema.parse(id);
    const { title, vendorId } = await restoreListing(k, listingId);
    revalidateWeb([CATALOG_TAGS.events, CATALOG_TAGS.shows]);
    await logActivity(actorOf(current, vendorId), {
      action: "listing_restore",
      resource: "event",
      resourceId: listingId,
      summary: `Restored ${LISTING_SECTIONS[k].one.toLowerCase()} ${title}`,
      changedFields: ["takenDownAt", "takedownReason"],
    });
    return { title };
  });
}

// Online streams ----------------------------------------------------------------------------------------------------

export async function createStreamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("streaming:write");
    const { id, title } = await createStream(input);
    revalidateWeb([CATALOG_TAGS.streamTitles]);
    await logActivity(actorOf(current), {
      action: "stream_create",
      resource: "stream_title",
      resourceId: id,
      summary: `Added stream title ${title}`,
      changedFields: [],
    });
    return { id };
  });
}

export async function updateStreamAction(id: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("streaming:write");
    const streamId = objectIdSchema.parse(id);
    const { title, changedFields } = await updateStream(streamId, input);
    revalidateWeb([CATALOG_TAGS.streamTitles]);
    await logActivity(actorOf(current), {
      action: "stream_update",
      resource: "stream_title",
      resourceId: streamId,
      summary: `Updated stream title ${title}`,
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function moveStreamAction(input: unknown): Promise<ActionResult<{ moved: boolean }>> {
  return runAction(async () => {
    const current = await requirePermission("streaming:write");
    const result = await moveStream(input);
    if (result.moved) {
      revalidateWeb([CATALOG_TAGS.streamTitles]);
      await logActivity(actorOf(current), {
        action: "stream_reorder",
        resource: "stream_title",
        summary: "Reordered stream titles",
        changedFields: ["sortOrder"],
      });
    }
    return result;
  });
}

// Media Library -----------------------------------------------------------------------------------------------------

/** FormData: `file` (JPEG/PNG/WebP, ≤ 4 MB) and optional `alt`. */
export async function uploadMediaAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const current = await requirePermission("media-library:write");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION_FAILED", "Choose an image to upload.", 422, {
        fieldErrors: { file: ["Choose an image to upload."] },
      });
    }
    const saved = await uploadMedia(
      { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      formData.get("alt"),
      current.staff.id,
    );
    await logActivity(actorOf(current), {
      action: "media_upload",
      resource: "media",
      resourceId: saved.id,
      summary: `Uploaded ${saved.filename}`,
      changedFields: [],
    });
    return { url: saved.url };
  });
}

export async function deleteMediaAction(id: unknown): Promise<ActionResult<{ deleted: true }>> {
  return runAction(async () => {
    const current = await requirePermission("media-library:write");
    const fileId = objectIdSchema.parse(id);
    const { filename } = await deleteMedia(fileId);
    await logActivity(actorOf(current), {
      action: "media_delete",
      resource: "media",
      resourceId: fileId,
      summary: `Deleted ${filename}`,
      changedFields: [],
    });
    return { deleted: true as const };
  });
}

// Backup ------------------------------------------------------------------------------------------------------------

export async function topUpDemoShowsAction(): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const current = await requirePermission("backup:write");
    const result = await topUpDemoShows(new Date());
    revalidateWeb([CATALOG_TAGS.shows]);
    await logActivity(actorOf(current), {
      action: "demo_shows_top_up",
      resource: "show",
      summary: `Generated demo shows for the next 7 days (${result.created} new)`,
      changedFields: [],
    });
    return result;
  });
}
