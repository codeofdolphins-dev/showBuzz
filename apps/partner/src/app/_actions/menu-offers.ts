"use server";

import { z } from "zod";
import { requireListingAccess } from "@showbuzz/core/auth/partner/current-vendor";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  createVendorCoupon,
  setVendorCouponStatus,
  updateVendorCoupon,
} from "@showbuzz/core/services/partner/coupon.service";
import { createFoodItem, setFoodAvailability, updateFoodItem } from "@showbuzz/core/services/partner/food.service";
import { updateVendorPolicy } from "@showbuzz/core/services/partner/policy.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { actorOf } from "@/lib/actor";

/**
 * Food menu, coupons and the cancellation policy: all shown on showbuzz.com, so every change refreshes the public
 * cache (food step, /offers and checkout coupons, cancellation labels on cinema/event pages).
 */

const recordIdSchema = z.string().trim().min(1).max(64);

// ---------------------------------------------------------------------------------------------------------------
// Food & beverages

export async function createFoodItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, name } = await createFoodItem(current.vendor.id, input);
    revalidateWeb([CATALOG_TAGS.foodItems]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "food_item",
      resourceId: id,
      summary: `Added "${name}" to the food menu`.slice(0, 300),
    });
    return { id };
  });
}

export async function updateFoodItemAction(itemId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, name, changedFields } = await updateFoodItem(current.vendor.id, recordIdSchema.parse(itemId), input);
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.foodItems]);
      await logActivity(actorOf(current), {
        action: "update",
        resource: "food_item",
        resourceId: id,
        summary: `Edited "${name}" on the food menu`.slice(0, 300),
        changedFields,
      });
    }
    return { id };
  });
}

export async function setFoodAvailabilityAction(
  itemId: unknown,
  available: unknown,
): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(itemId);
    const on = z.boolean().parse(available);
    const { name } = await setFoodAvailability(current.vendor.id, id, on);
    revalidateWeb([CATALOG_TAGS.foodItems]);
    await logActivity(actorOf(current), {
      action: "status_change",
      resource: "food_item",
      resourceId: id,
      summary: `${on ? "Made available" : "Took off the menu"}: "${name}"`.slice(0, 300),
      changedFields: ["available"],
    });
    return { available: on };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Coupons

export async function createCouponAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, code } = await createVendorCoupon(current.vendor.id, input);
    revalidateWeb([CATALOG_TAGS.coupons]);
    await logActivity(actorOf(current), {
      action: "create",
      resource: "coupon",
      resourceId: id,
      summary: `Created coupon ${code}`,
    });
    return { id };
  });
}

export async function updateCouponAction(couponId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { id, code, changedFields } = await updateVendorCoupon(
      current.vendor.id,
      recordIdSchema.parse(couponId),
      input,
    );
    if (changedFields.length > 0) {
      revalidateWeb([CATALOG_TAGS.coupons]);
      await logActivity(actorOf(current), {
        action: "update",
        resource: "coupon",
        resourceId: id,
        summary: `Edited coupon ${code}`,
        changedFields,
      });
    }
    return { id };
  });
}

export async function setCouponStatusAction(
  couponId: unknown,
  status: unknown,
): Promise<ActionResult<{ status: "active" | "inactive" }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const id = recordIdSchema.parse(couponId);
    const next = z.enum(["active", "inactive"]).parse(status);
    const { code } = await setVendorCouponStatus(current.vendor.id, id, next);
    revalidateWeb([CATALOG_TAGS.coupons]);
    await logActivity(actorOf(current), {
      action: "status_change",
      resource: "coupon",
      resourceId: id,
      summary: `${next === "active" ? "Activated" : "Deactivated"} coupon ${code}`,
      changedFields: ["status"],
    });
    return { status: next };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Cancellation policy

export async function updatePolicyAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const { changedFields } = await updateVendorPolicy(current.vendor.id, input);
    if (changedFields.length > 0) {
      // Cancellation labels on cinema and event pages are built from the vendor's policy.
      revalidateWeb([CATALOG_TAGS.vendors, CATALOG_TAGS.venues, CATALOG_TAGS.events]);
      await logActivity(actorOf(current), {
        action: "policy_change",
        resource: "vendor",
        resourceId: current.vendor.id,
        summary: "Changed the cancellation policy (applies to new bookings)",
        changedFields,
      });
    }
    return { saved: true as const };
  });
}
