"use server";

import { bookingCodeSchema, orderDraftSchema, type OrderDraftInput, type PlaceOrderInput } from "@/schemas/booking";
import { runAction } from "@/server/http/action-result";
import { cancelBooking, placeDemoOrder } from "@/server/services/booking.service";
import { quoteOrder } from "@/server/services/pricing.service";

export async function quoteOrderAction(draft: OrderDraftInput) {
  return runAction(() => quoteOrder(orderDraftSchema.parse(draft), new Date()));
}

export async function placeOrderAction(input: PlaceOrderInput) {
  return runAction(() => placeDemoOrder(input, new Date()));
}

export async function cancelBookingAction(code: string) {
  return runAction(() => cancelBooking(bookingCodeSchema.parse(code), new Date()));
}
