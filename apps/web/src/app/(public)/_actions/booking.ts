"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  bookingCodeSchema,
  orderDraftSchema,
  seatIdSchema,
  showIdSchema,
  type OrderDraftInput,
  type PlaceOrderInput,
} from "@showbuzz/schemas/booking";
import { getOrCreateHolderKey, readHolderKey } from "@showbuzz/core/booking/hold-cookie";
import { getCurrentCustomer, requireCustomer } from "@showbuzz/core/auth/current-customer";
import { AppError } from "@showbuzz/core/http/app-error";
import { runAction } from "@showbuzz/core/http/action-result";
import { getClientIp } from "@showbuzz/core/http/request";
import { cancelBooking, confirmPayment, placeOrder } from "@showbuzz/core/services/booking.service";
import { quoteOrder } from "@showbuzz/core/services/pricing.service";
import { holdSeats } from "@showbuzz/core/services/seat-hold.service";
import { loadSeatPlan, priceSeats } from "@showbuzz/core/services/seat-map.service";
import { getSettings } from "@showbuzz/core/services/settings.service";
import { getShowDetails } from "@showbuzz/core/services/show.service";
import { deviceClass } from "@showbuzz/utils/user-agent";

const holdSeatsSchema = z.object({
  showId: showIdSchema,
  seatIds: z
    .array(seatIdSchema)
    .min(1, "Select at least one seat")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate seats selected"),
});

const confirmPaymentSchema = z.object({
  code: bookingCodeSchema,
  simulate: z.enum(["success", "failure"]),
});

async function clientIp() {
  return getClientIp(await headers());
}

export async function quoteOrderAction(draft: OrderDraftInput) {
  return runAction(async () => {
    const customer = await getCurrentCustomer();
    return quoteOrder(orderDraftSchema.parse(draft), new Date(), {
      holderKey: await readHolderKey(),
      giftCardContext: { userId: customer?.id, ip: await clientIp() },
    });
  });
}

/**
 * Holds the chosen seats for this browser (no sign-in needed yet) and returns the real hold expiry.
 * Replaces any earlier selection; a seat someone else holds or bought answers 409 with the taken seats.
 */
export async function holdSeatsAction(input: z.input<typeof holdSeatsSchema>) {
  return runAction(async () => {
    const { showId, seatIds } = holdSeatsSchema.parse(input);
    const now = new Date();
    const settings = await getSettings();
    if (seatIds.length > settings.maxTicketsPerOrder) {
      throw new AppError("VALIDATION_FAILED", `Maximum ${settings.maxTicketsPerOrder} seats per booking.`, 422);
    }
    const show = await getShowDetails(showId, now);
    const plan = show && (await loadSeatPlan(show.id));
    if (!show || !plan) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    // Rejects seat ids that don't exist on this layout (availability is decided by the unique index below).
    priceSeats(show, plan, seatIds);

    const holderKey = await getOrCreateHolderKey();
    const expiresAt = new Date(now.getTime() + settings.seatHoldMinutes * 60_000);
    const hold = await holdSeats(showId, seatIds, holderKey, now, expiresAt);
    return { expiresAt: hold.expiresAt.toISOString() };
  });
}

/** Sign-in is required before payment (decided 2026-10-13); the owner comes from the session only. */
export async function placeOrderAction(input: PlaceOrderInput) {
  return runAction(async () =>
    placeOrder(
      input,
      await requireCustomer(),
      {
        holderKey: await readHolderKey(),
        ip: await clientIp(),
        device: deviceClass((await headers()).get("user-agent")),
      },
      new Date(),
    ),
  );
}

/** Confirms the order's payment on the server; with the simulated gateway `simulate` picks the outcome. */
export async function confirmPaymentAction(input: z.input<typeof confirmPaymentSchema>) {
  return runAction(async () => {
    const customer = await requireCustomer();
    const { code, simulate } = confirmPaymentSchema.parse(input);
    return confirmPayment(code, customer.id, simulate, new Date());
  });
}

export async function cancelBookingAction(code: string) {
  return runAction(async () => {
    const customer = await requireCustomer();
    return cancelBooking(bookingCodeSchema.parse(code), customer.id, new Date());
  });
}
