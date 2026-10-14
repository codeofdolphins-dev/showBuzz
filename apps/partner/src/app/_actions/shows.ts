"use server";

import { z } from "zod";
import { requireListingAccess } from "@showbuzz/core/auth/partner/current-vendor";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  cancelShow,
  createShow,
  createShowSchedule,
  updateShow,
} from "@showbuzz/core/services/partner/show-schedule.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { actorOf } from "@/lib/actor";

/**
 * The show schedule. Showtimes and seat maps are read live on showbuzz.com; the shows tag still refreshes the cached
 * "which show is this fixture" lookup used by sports pages.
 */

const recordIdSchema = z.string().trim().min(1).max(64);

export async function createShowAction(
  input: unknown,
): Promise<ActionResult<{ id: string; replacedDemoShows: number }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const result = await createShow(current.vendor.id, input, new Date());
    revalidateWeb([CATALOG_TAGS.shows]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "show",
      resourceId: result.id,
      summary:
        result.replacedDemoShows > 0
          ? `Scheduled a show (${result.replacedDemoShows} demo show(s) cancelled to free the screen)`
          : "Scheduled a show",
    });
    return result;
  });
}

export async function createShowScheduleAction(
  input: unknown,
): Promise<ActionResult<{ created: number; replacedDemoShows: number }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const result = await createShowSchedule(current.vendor.id, input, new Date());
    revalidateWeb([CATALOG_TAGS.shows]);
    await logActivity(actorOf(current), {
      action: "bulk_create",
      resource: "show",
      summary: `Scheduled ${result.created} shows${
        result.replacedDemoShows > 0 ? ` (${result.replacedDemoShows} demo show(s) cancelled)` : ""
      }`,
    });
    return result;
  });
}

export async function updateShowAction(showId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(showId);
    const { changedFields, isFixture } = await updateShow(current.vendor.id, id, input, new Date());
    if (changedFields.length > 0) {
      revalidateWeb(isFixture ? [CATALOG_TAGS.shows, CATALOG_TAGS.events] : [CATALOG_TAGS.shows]);
      await logActivity(actorOf(current), {
        action: "update",
        resource: "show",
        resourceId: id,
        summary: "Changed show prices or format",
        changedFields,
      });
    }
    return { id };
  });
}

export async function cancelShowAction(showId: unknown): Promise<ActionResult<{ title: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(showId);
    const { title } = await cancelShow(current.vendor.id, id, new Date());
    revalidateWeb([CATALOG_TAGS.shows]);
    await logActivity(actorOf(current), {
      action: "status_change",
      resource: "show",
      resourceId: id,
      summary: `Cancelled a show of "${title}"`.slice(0, 300),
      changedFields: ["status"],
    });
    return { title };
  });
}
