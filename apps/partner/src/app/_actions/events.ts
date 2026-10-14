"use server";

import { z } from "zod";
import { requireListingAccess } from "@showbuzz/core/auth/partner/current-vendor";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import { createEvent, updateEvent } from "@showbuzz/core/services/partner/listing.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { EVENT_KIND_LABELS } from "@showbuzz/schemas/partner-listing";
import { actorOf } from "@/lib/actor";

/**
 * Events, plays, sports and activities. Saving also writes the pass inventory or the fixture's seated show, so the
 * public listing, its tiers and the sports seat-map link are refreshed together.
 */

const recordIdSchema = z.string().trim().min(1).max(64);

export async function createEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, kind, changedFields } = await createEvent(current.vendor.id, input, new Date());
    revalidateWeb([CATALOG_TAGS.events, CATALOG_TAGS.shows]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "event",
      resourceId: id,
      summary: `Added a listing (${EVENT_KIND_LABELS[kind].one})`,
      changedFields,
    });
    return { id };
  });
}

export async function updateEventAction(eventId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(eventId);
    const { kind, changedFields } = await updateEvent(current.vendor.id, id, input, new Date());
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.events, CATALOG_TAGS.shows]);
      await logActivity(actorOf(current), {
        action: changedFields.includes("status") ? "status_change" : "update",
        resource: "event",
        resourceId: id,
        summary: `Updated a listing (${EVENT_KIND_LABELS[kind].one})`,
        changedFields,
      });
    }
    return { id };
  });
}
