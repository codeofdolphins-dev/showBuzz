"use server";

import { requireListingAccess, requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { AppError } from "@showbuzz/core/http/app-error";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { cancelVendorBooking } from "@showbuzz/core/services/partner/booking.service";
import { checkInTicket } from "@showbuzz/core/services/partner/checkin.service";
import { sellAtCounter } from "@showbuzz/core/services/partner/counter-sale.service";
import type { CheckInResult, CounterSaleResult } from "@showbuzz/schemas/types/partner-box-office";
import { formatINR } from "@showbuzz/utils/money";
import { actorOf } from "@/lib/actor";

/**
 * Box office: vendor cancellations, counter sales and gate check-in. The vendor is always the signed-in one; the
 * services scope every booking to it. Seat maps and pass counts are read live on showbuzz.com, so none of these
 * needs a cache refresh there.
 */

export async function cancelBookingAction(
  input: unknown,
): Promise<ActionResult<{ code: string; refundPaise: number }>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const result = await cancelVendorBooking(current.vendor.id, input, new Date());
    await logActivity(actorOf(current), {
      action: result.outsidePolicy ? "cancel_override" : "cancel",
      resource: "booking",
      resourceId: result.code,
      summary: `Cancelled booking ${result.code}, refund ${formatINR(result.refundPaise, { exact: true })}${
        result.waived ? " (fee waived)" : ""
      }${result.outsidePolicy ? " outside the cancellation policy" : ""}`,
      changedFields: ["status", "refundPaise", ...(result.outsidePolicy ? ["cancelReason"] : [])],
    });
    return { code: result.code, refundPaise: result.refundPaise };
  });
}

export async function sellAtCounterAction(input: unknown): Promise<ActionResult<CounterSaleResult>> {
  return runAction(async () => {
    const current = await requireListingAccess();
    const sale = await sellAtCounter(current.vendor.id, current.vendorUser.id, input, new Date());
    await logActivity(actorOf(current), {
      action: "counter_sale",
      resource: "booking",
      resourceId: sale.code,
      summary: `Counter sale ${sale.code}: ${sale.ticketCount} ticket(s), ${formatINR(sale.totalPaise, { exact: true })}`,
    });
    return sale;
  });
}

/** Gate scans keep working for a suspended vendor (its tickets are already sold); onboarding must be complete. */
export async function checkInAction(input: unknown): Promise<ActionResult<CheckInResult>> {
  return runAction(async () => {
    const current = await requireVendor();
    if (current.vendor.onboardingStatus !== "complete") {
      throw new AppError("ONBOARDING_INCOMPLETE", "Finish onboarding first.", 403);
    }
    const result = await checkInTicket(current.vendor.id, current.vendorUser.id, input, new Date());
    if (result.outcome === "checked_in") {
      await logActivity(actorOf(current), {
        action: "check_in",
        resource: "booking",
        resourceId: result.ticket.code,
        summary: `Checked in ${result.ticket.code} (${result.ticket.ticketCount} ticket(s))`,
        changedFields: ["checkedInAt"],
      });
    }
    return result;
  });
}
