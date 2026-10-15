"use server";

import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import { cancelBookingByStaff } from "@showbuzz/core/services/admin/booking-admin.service";
import { blockCustomer, unblockCustomer } from "@showbuzz/core/services/admin/customer-admin.service";
import { moderateReview } from "@showbuzz/core/services/admin/review-admin.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { formatINR } from "@showbuzz/utils/money";
import { actorOf } from "@/lib/actor";

/** Customers (block / unblock), bookings oversight (staff cancel & refund) and review moderation. */

export async function blockCustomerAction(customerId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("customers:write");
    const id = objectIdSchema.parse(customerId);
    const { name } = await blockCustomer(id, input, new Date());
    await logActivity(actorOf(current), {
      action: "customer_block",
      resource: "customer",
      resourceId: id,
      summary: `Blocked customer ${name} (signed out everywhere)`,
      changedFields: ["status", "blockedAt", "blockReason", "sessions"],
    });
    return { saved: true as const };
  });
}

export async function unblockCustomerAction(customerId: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("customers:write");
    const id = objectIdSchema.parse(customerId);
    const { name } = await unblockCustomer(id);
    await logActivity(actorOf(current), {
      action: "customer_unblock",
      resource: "customer",
      resourceId: id,
      summary: `Unblocked customer ${name}`,
      changedFields: ["status", "blockedAt", "blockReason"],
    });
    return { saved: true as const };
  });
}

/** Staff cancellation with an override reason; the refund follows the shared cancellation rules. */
export async function cancelBookingByStaffAction(
  code: unknown,
  input: unknown,
): Promise<ActionResult<{ refundPaise: number }>> {
  return runAction(async () => {
    const current = await requirePermission("bookings:write");
    const bookingCode = bookingCodeSchema.parse(code);
    const result = await cancelBookingByStaff(current.staff.id, bookingCode, input, new Date());
    const notes = [result.outsidePolicy ? "outside the vendor's policy" : "", result.waived ? "fee waived" : ""]
      .filter(Boolean)
      .join(", ");
    await logActivity(actorOf(current, result.vendorId), {
      action: "booking_cancel",
      resource: "booking",
      resourceId: result.code,
      summary: `Cancelled ${result.code}, refund ${formatINR(result.refundPaise)}${notes ? ` (${notes})` : ""}`,
      changedFields: ["status", "cancelledAt", "cancelledBy", "cancelReason", "refundPaise"],
    });
    return { refundPaise: result.refundPaise };
  });
}

export async function moderateReviewAction(reviewId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("reviews:write");
    const id = objectIdSchema.parse(reviewId);
    const { movieTitle, changed } = await moderateReview(id, input, current.staff.id, new Date());
    if (changed) {
      const hidden = (input as { status?: string } | null)?.status === "hidden";
      await logActivity(actorOf(current), {
        action: hidden ? "review_hide" : "review_publish",
        resource: "review",
        resourceId: id,
        summary: `${hidden ? "Hid" : "Published"} a review of ${movieTitle}`,
        changedFields: ["status"],
      });
      revalidateWeb([CATALOG_TAGS.movies]);
    }
    return { saved: true as const };
  });
}
