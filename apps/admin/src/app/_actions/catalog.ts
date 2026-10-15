"use server";

import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  mergeMovies,
  previewMovieMerge,
  searchMergeTargets,
  updateMovieByStaff,
} from "@showbuzz/core/services/admin/movie-admin.service";
import { findPossibleDuplicates } from "@showbuzz/core/services/partner/movie.service";
import { addShowRequestNote, setShowRequestStatus } from "@showbuzz/core/services/admin/show-request.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { movieMergeSchema } from "@showbuzz/schemas/admin-marketplace";
import { objectIdSchema } from "@showbuzz/schemas/common";
import type { MovieMergePreview } from "@showbuzz/schemas/types/admin-marketplace";
import { actorOf } from "@/lib/actor";

/** List-your-show requests and the movie catalogue (merge duplicates). */

export async function setShowRequestStatusAction(
  requestId: unknown,
  status: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("list-your-show:write");
    const id = objectIdSchema.parse(requestId);
    const { reference } = await setShowRequestStatus(id, status);
    await logActivity(actorOf(current), {
      action: "lead_status_change",
      resource: "lead",
      resourceId: id,
      summary: `Changed the status of ${reference}`,
      changedFields: ["status"],
    });
    return { saved: true as const };
  });
}

export async function addShowRequestNoteAction(
  requestId: unknown,
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("list-your-show:write");
    const id = objectIdSchema.parse(requestId);
    const { reference } = await addShowRequestNote(
      id,
      input,
      { id: current.staff.id, name: current.staff.name },
      new Date(),
    );
    await logActivity(actorOf(current), {
      action: "lead_note_add",
      resource: "lead",
      resourceId: id,
      summary: `Added a note to ${reference}`,
      changedFields: ["notes"],
    });
    return { saved: true as const };
  });
}

/** Films to merge into, for the merge dialog's search box. */
export async function searchMergeTargetsAction(
  sourceId: unknown,
  q: unknown,
): Promise<ActionResult<{ value: string; label: string }[]>> {
  return runAction(async () => {
    await requirePermission("movies:write");
    return searchMergeTargets(objectIdSchema.parse(sourceId), typeof q === "string" ? q.slice(0, 100) : "");
  });
}

export async function previewMovieMergeAction(input: unknown): Promise<ActionResult<MovieMergePreview>> {
  return runAction(async () => {
    await requirePermission("movies:write");
    return previewMovieMerge(input);
  });
}

export async function mergeMoviesAction(input: unknown): Promise<ActionResult<{ keepSlug: string }>> {
  return runAction(async () => {
    const current = await requirePermission("movies:write");
    const { sourceId, keepId } = movieMergeSchema.parse(input);
    const result = await mergeMovies({ sourceId, keepId }, new Date());
    await logActivity(actorOf(current), {
      action: "movie_merge",
      resource: "movie",
      resourceId: sourceId,
      summary: `Merged "${result.source}" into "${result.keep}" (${keepId})`,
      changedFields: ["archivedAt", "mergedIntoId", "shows", "reviews", "wishlists", "vendorMovies"],
    });
    revalidateWeb([CATALOG_TAGS.movies, CATALOG_TAGS.shows, CATALOG_TAGS.coupons]);
    return { keepSlug: result.keepSlug };
  });
}

// Film editor (prompt 7)

export async function updateMovieByStaffAction(
  movieId: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("movies:write");
    const id = objectIdSchema.parse(movieId);
    const { title, changedFields } = await updateMovieByStaff(id, input);
    if (changedFields.length > 0) {
      await logActivity(actorOf(current), {
        action: "movie_update",
        resource: "movie",
        resourceId: id,
        summary: `Edited film ${title}`,
        changedFields,
      });
      revalidateWeb([CATALOG_TAGS.movies]);
    }
    return { id };
  });
}

export async function findMovieDuplicatesAction(
  title: unknown,
  exceptId?: unknown,
): Promise<ActionResult<{ id: string; title: string; year: string; languages: string[] }[]>> {
  return runAction(async () => {
    await requirePermission("movies:read");
    const text = typeof title === "string" ? title.slice(0, 150) : "";
    const except = exceptId === undefined ? undefined : objectIdSchema.parse(exceptId);
    return findPossibleDuplicates(text, except);
  });
}
