"use server";

import { z } from "zod";
import { requireListingAccess } from "@showbuzz/core/auth/partner/current-vendor";
import type { CurrentVendor } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  addScreen,
  createVenue,
  deleteScreen,
  saveSeatLayout,
  updateScreen,
  updateVenue,
} from "@showbuzz/core/services/partner/venue.service";
import {
  blockShowSeats,
  releaseHeldSeats,
  unblockShowSeats,
} from "@showbuzz/core/services/partner/seat-management.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";

/**
 * Venues, screens, seat layouts and per-show seat blocks. Every action needs a vendor that may change listings
 * (onboarded, not suspended); the vendor id comes from the session and the services scope every query by it.
 * Saves that change what showbuzz.com shows (venue details, screens, layouts) refresh its venue cache.
 */

const recordIdSchema = z.string().trim().min(1).max(64);

const actorOf = ({ vendorUser, vendor }: CurrentVendor) => ({
  type: "vendor" as const,
  id: vendorUser.id,
  vendorId: vendor.id,
});

export async function createVenueAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, changedFields } = await createVenue(current.vendor.id, input);
    revalidateWeb([CATALOG_TAGS.venues]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "venue",
      resourceId: id,
      summary: "Added a venue",
      changedFields,
    });
    return { id };
  });
}

export async function updateVenueAction(venueId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(venueId);
    const { changedFields } = await updateVenue(current.vendor.id, id, input, new Date());
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.venues]);
      await logActivity(actorOf(current), {
        action: changedFields.includes("status") ? "status_change" : "update",
        resource: "venue",
        resourceId: id,
        summary: "Updated venue details",
        changedFields,
      });
    }
    return { id };
  });
}

export async function addScreenAction(venueId: unknown, input: unknown): Promise<ActionResult<{ screenId: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(venueId);
    const { screenId, changedFields } = await addScreen(current.vendor.id, id, input);
    revalidateWeb([CATALOG_TAGS.venues]);
    await logActivity(actorOf(current), {
      action: "screen_create",
      resource: "venue",
      resourceId: id,
      summary: `Added screen ${screenId}`,
      changedFields,
    });
    return { screenId };
  });
}

export async function updateScreenAction(
  venueId: unknown,
  screenId: unknown,
  input: unknown,
): Promise<ActionResult<{ screenId: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(venueId);
    const screen = recordIdSchema.parse(screenId);
    const { changedFields } = await updateScreen(current.vendor.id, id, screen, input, new Date());
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.venues]);
      await logActivity(actorOf(current), {
        action: "screen_update",
        resource: "venue",
        resourceId: id,
        summary: `Updated screen ${screen}`,
        changedFields,
      });
    }
    return { screenId: screen };
  });
}

export async function deleteScreenAction(venueId: unknown, screenId: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(venueId);
    const screen = recordIdSchema.parse(screenId);
    const { name } = await deleteScreen(current.vendor.id, id, screen, new Date());
    revalidateWeb([CATALOG_TAGS.venues]);
    await logActivity(actorOf(current), {
      action: "screen_delete",
      resource: "venue",
      resourceId: id,
      summary: `Removed screen ${screen}`,
      changedFields: ["screens"],
    });
    return { name };
  });
}

export async function saveSeatLayoutAction(
  venueId: unknown,
  screenId: unknown,
  input: unknown,
): Promise<ActionResult<{ capacity: number }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(venueId);
    const screen = recordIdSchema.parse(screenId);
    const { changedFields, capacity } = await saveSeatLayout(current.vendor.id, id, screen, input, new Date());
    revalidateWeb([CATALOG_TAGS.venues]);
    await logActivity(actorOf(current), {
      action: "seat_layout_save",
      resource: "venue",
      resourceId: id,
      summary: `Saved the seat layout of screen ${screen} (${capacity} seats)`,
      changedFields,
    });
    return { capacity };
  });
}

// Seat maps are read live (never cached), so per-show seat changes need no web revalidation.

export async function blockSeatsAction(
  input: unknown,
): Promise<ActionResult<{ changed: string[]; skipped: string[] }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { showId, changed, skipped } = await blockShowSeats(current.vendor.id, input, new Date());
    if (changed.length > 0) {
      await logActivity(actorOf(current), {
        action: "seat_block",
        resource: "show",
        resourceId: showId,
        summary: `Blocked ${changed.length} seat(s): ${changed.join(", ")}`.slice(0, 300),
      });
    }
    return { changed, skipped };
  });
}

export async function unblockSeatsAction(
  input: unknown,
): Promise<ActionResult<{ changed: string[]; skipped: string[] }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { showId, changed, skipped } = await unblockShowSeats(current.vendor.id, input, new Date());
    if (changed.length > 0) {
      await logActivity(actorOf(current), {
        action: "seat_unblock",
        resource: "show",
        resourceId: showId,
        summary: `Unblocked ${changed.length} seat(s): ${changed.join(", ")}`.slice(0, 300),
      });
    }
    return { changed, skipped };
  });
}

export async function releaseHoldsAction(
  input: unknown,
): Promise<ActionResult<{ changed: string[]; skipped: string[]; pendingOrders: number }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { showId, changed, skipped, pendingOrders } = await releaseHeldSeats(current.vendor.id, input, new Date());
    if (changed.length > 0) {
      await logActivity(actorOf(current), {
        action: "seat_hold_release",
        resource: "show",
        resourceId: showId,
        summary: `Released ${changed.length} held seat(s): ${changed.join(", ")}`.slice(0, 300),
      });
    }
    return { changed, skipped, pendingOrders };
  });
}
