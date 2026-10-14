"use server";

import { z } from "zod";
import { requireListingAccess, requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  addMovieToVendor,
  createMovie,
  findPossibleDuplicates,
  removeMovieFromVendor,
  searchCatalogMovies,
  updateMovie,
} from "@showbuzz/core/services/partner/movie.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import type { MovieSearchHit } from "@showbuzz/schemas/types/partner-listing";
import { actorOf } from "@/lib/actor";

/**
 * Movies: the shared catalogue search, the vendor's "My movies" list and the films a vendor creates. Reads need a
 * signed-in vendor; changes need listing access (onboarded, not suspended). The vendor id always comes from the
 * session.
 */

const recordIdSchema = z.string().trim().min(1).max(64);

export async function searchMoviesAction(input: unknown): Promise<ActionResult<MovieSearchHit[]>> {
  return runAction(async () => {
    const { vendor } = await requireVendor();
    return searchCatalogMovies(vendor.id, input);
  });
}

export async function findDuplicatesAction(
  title: unknown,
  exceptId?: unknown,
): Promise<ActionResult<{ id: string; title: string; year: string; languages: string[] }[]>> {
  return runAction(async () => {
    await requireVendor();
    const text = z.string().max(150).parse(title);
    const except = exceptId === undefined ? undefined : recordIdSchema.parse(exceptId);
    return findPossibleDuplicates(text, except);
  });
}

export async function addMovieAction(movieId: unknown): Promise<ActionResult<{ title: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(movieId);
    const { title, added } = await addMovieToVendor(current.vendor.id, id);
    if (added) {
      await logActivity(actorOf(current), {
        action: "movie_add",
        resource: "movie",
        resourceId: id,
        summary: `Added "${title}" to My movies`.slice(0, 300),
      });
    }
    return { title };
  });
}

export async function removeMovieAction(movieId: unknown): Promise<ActionResult<{ title: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(movieId);
    const { title } = await removeMovieFromVendor(current.vendor.id, id, new Date());
    await logActivity(actorOf(current), {
      action: "movie_remove",
      resource: "movie",
      resourceId: id,
      summary: `Removed "${title}" from My movies`.slice(0, 300),
    });
    return { title };
  });
}

export async function createMovieAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, changedFields } = await createMovie(current.vendor.id, input);
    revalidateWeb([CATALOG_TAGS.movies]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "movie",
      resourceId: id,
      summary: "Added a film to the ShowBuzz catalogue",
      changedFields,
    });
    return { id };
  });
}

export async function updateMovieAction(movieId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(movieId);
    const { changedFields } = await updateMovie(current.vendor.id, id, input);
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.movies]);
      await logActivity(actorOf(current), {
        action: "update",
        resource: "movie",
        resourceId: id,
        summary: "Updated film details",
        changedFields,
      });
    }
    return { id };
  });
}
