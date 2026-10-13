"use server";

import { bookingCodeSchema, orderDraftSchema, type OrderDraftInput, type PlaceOrderInput } from "@showbuzz/schemas/booking";
import { requireCustomer } from "@showbuzz/core/auth/current-customer";
import { runAction } from "@showbuzz/core/http/action-result";
import { cancelBooking, placeDemoOrder } from "@showbuzz/core/services/booking.service";
import { quoteOrder } from "@showbuzz/core/services/pricing.service";

export async function quoteOrderAction(draft: OrderDraftInput) {
  return runAction(() => quoteOrder(orderDraftSchema.parse(draft), new Date()));
}

/** Sign-in is required before payment (decided 2026-10-13); the owner comes from the session only. */
export async function placeOrderAction(input: PlaceOrderInput) {
  return runAction(async () => placeDemoOrder(input, await requireCustomer(), new Date()));
}

export async function cancelBookingAction(code: string) {
  return runAction(async () => {
    const customer = await requireCustomer();
    return cancelBooking(bookingCodeSchema.parse(code), customer.id, new Date());
  });
}
