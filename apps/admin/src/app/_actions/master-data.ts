"use server";

import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  createCity,
  createGenre,
  createLanguage,
  moveCity,
  moveGenre,
  moveLanguage,
  updateCity,
  updateGenre,
  updateLanguage,
} from "@showbuzz/core/services/admin/master-data-admin.service";
import { updateSettings } from "@showbuzz/core/services/admin/settings-admin.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { actorOf } from "@/lib/actor";

/**
 * Master data (cities, languages, genres) and platform settings. Cities feed the public city picker; languages and
 * genres feed the movie/event forms of both consoles and the home page chips; a rename is carried into the listings.
 */

// Cities

export async function createCityAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("cities:write");
    const city = await createCity(input);
    await logActivity(actorOf(current), {
      action: "city_create",
      resource: "city",
      resourceId: city.id,
      summary: `Added city ${city.name}`,
      changedFields: ["name", "slug", "state", "tier", "popular", "status"],
    });
    revalidateWeb([CATALOG_TAGS.cities]);
    return { id: city.id };
  });
}

export async function updateCityAction(cityId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("cities:write");
    const id = objectIdSchema.parse(cityId);
    const { name, changedFields } = await updateCity(id, input);
    await logActivity(actorOf(current), {
      action: "city_update",
      resource: "city",
      resourceId: id,
      summary: `Updated city ${name}`,
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.cities]);
    return { saved: true as const };
  });
}

export async function moveCityAction(input: unknown): Promise<ActionResult<{ moved: boolean }>> {
  return runAction(async () => {
    const current = await requirePermission("cities:write");
    const result = await moveCity(input);
    if (result.moved) {
      await logActivity(actorOf(current), {
        action: "city_reorder",
        resource: "city",
        summary: "Changed the order of cities",
        changedFields: ["sortOrder"],
      });
      revalidateWeb([CATALOG_TAGS.cities]);
    }
    return result;
  });
}

// Languages

export async function createLanguageAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("languages:write");
    const language = await createLanguage(input);
    await logActivity(actorOf(current), {
      action: "language_create",
      resource: "language",
      resourceId: language.id,
      summary: `Added language ${language.name}`,
      changedFields: ["name", "nativeName", "status"],
    });
    revalidateWeb([CATALOG_TAGS.languages]);
    return { id: language.id };
  });
}

export async function updateLanguageAction(
  languageId: unknown,
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("languages:write");
    const id = objectIdSchema.parse(languageId);
    const { name, changedFields, renamed } = await updateLanguage(id, input);
    await logActivity(actorOf(current), {
      action: "language_update",
      resource: "language",
      resourceId: id,
      summary: renamed ? `Renamed a language to ${name} (listings updated)` : `Updated language ${name}`,
      changedFields,
    });
    revalidateWeb(
      renamed
        ? [CATALOG_TAGS.languages, CATALOG_TAGS.movies, CATALOG_TAGS.events, CATALOG_TAGS.venues]
        : [CATALOG_TAGS.languages],
    );
    return { saved: true as const };
  });
}

export async function moveLanguageAction(input: unknown): Promise<ActionResult<{ moved: boolean }>> {
  return runAction(async () => {
    const current = await requirePermission("languages:write");
    const result = await moveLanguage(input);
    if (result.moved) {
      await logActivity(actorOf(current), {
        action: "language_reorder",
        resource: "language",
        summary: "Changed the order of languages",
        changedFields: ["sortOrder"],
      });
      revalidateWeb([CATALOG_TAGS.languages]);
    }
    return result;
  });
}

// Genres

export async function createGenreAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("genres:write");
    const genre = await createGenre(input);
    await logActivity(actorOf(current), {
      action: "genre_create",
      resource: "genre",
      resourceId: genre.id,
      summary: `Added genre ${genre.name}`,
      changedFields: ["name", "slug", "appliesTo", "status"],
    });
    revalidateWeb([CATALOG_TAGS.genres]);
    return { id: genre.id };
  });
}

export async function updateGenreAction(genreId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("genres:write");
    const id = objectIdSchema.parse(genreId);
    const { name, changedFields, renamed, appliesTo } = await updateGenre(id, input);
    await logActivity(actorOf(current), {
      action: "genre_update",
      resource: "genre",
      resourceId: id,
      summary: renamed ? `Renamed a genre to ${name} (listings updated)` : `Updated genre ${name}`,
      changedFields,
    });
    revalidateWeb(
      renamed
        ? [CATALOG_TAGS.genres, appliesTo === "movie" ? CATALOG_TAGS.movies : CATALOG_TAGS.events]
        : [CATALOG_TAGS.genres],
    );
    return { saved: true as const };
  });
}

export async function moveGenreAction(input: unknown): Promise<ActionResult<{ moved: boolean }>> {
  return runAction(async () => {
    const current = await requirePermission("genres:write");
    const result = await moveGenre(input);
    if (result.moved) {
      await logActivity(actorOf(current), {
        action: "genre_reorder",
        resource: "genre",
        summary: "Changed the order of genres",
        changedFields: ["sortOrder"],
      });
      revalidateWeb([CATALOG_TAGS.genres]);
    }
    return result;
  });
}

// Platform settings

export async function updateSettingsAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("settings:write");
    const { changedFields } = await updateSettings(input);
    if (changedFields.length > 0) {
      await logActivity(actorOf(current), {
        action: "settings_update",
        resource: "settings",
        summary: "Updated platform settings",
        changedFields,
      });
      revalidateWeb([CATALOG_TAGS.settings]);
    }
    return { saved: true as const };
  });
}
