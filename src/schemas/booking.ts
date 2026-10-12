import { z } from "zod";
import { MAX_TICKETS_PER_ORDER } from "@/config/constants";
import { idSchema, indianPhoneSchema, personNameSchema } from "./common";
import { giftCardOrderSchema } from "./gift-card";
import { couponCodeSchema } from "./offer";

/**
 * Show ids are opaque to clients. Movie shows are `<cinemaId>_<movieId>_<yyyymmdd>_<slot>`,
 * stadium fixtures are `sport_<eventId>`; booking.service parses them.
 */
export const showIdSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9-]+(?:_[a-z0-9-]+){1,3}$/, "Invalid show");

export const seatIdSchema = z.string().regex(/^[A-Z]\d{1,2}$/, "Invalid seat");

export const ticketSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("show"),
    showId: showIdSchema,
    seatIds: z
      .array(seatIdSchema)
      .min(1, "Select at least one seat")
      .max(MAX_TICKETS_PER_ORDER, `Maximum ${MAX_TICKETS_PER_ORDER} seats per booking`)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate seats selected"),
  }),
  z.object({
    kind: z.literal("event"),
    eventId: idSchema,
    tierId: idSchema,
    quantity: z.int().min(1).max(MAX_TICKETS_PER_ORDER),
  }),
  z.object({
    kind: z.literal("gift-card"),
    giftCard: giftCardOrderSchema,
  }),
]);

export const foodLineSchema = z.object({
  foodItemId: idSchema,
  quantity: z.int().min(1).max(20),
});

export const orderDraftSchema = z.object({
  tickets: ticketSelectionSchema,
  food: z.array(foodLineSchema).max(20).default([]),
  couponCode: couponCodeSchema.optional(),
});

export const contactDetailsSchema = z.object({
  name: personNameSchema,
  phone: indianPhoneSchema,
  email: z.email("Enter a valid email address"),
});

export const paymentMethodSchema = z.enum(["upi", "card", "netbanking", "wallet"]);

export const placeOrderSchema = orderDraftSchema.extend({
  contact: contactDetailsSchema,
  paymentMethod: paymentMethodSchema,
});

export const bookingCodeSchema = z.string().regex(/^SB-\d{6}$/, "Invalid booking id");

export type TicketSelection = z.infer<typeof ticketSelectionSchema>;
export type FoodLine = z.infer<typeof foodLineSchema>;
export type OrderDraft = z.infer<typeof orderDraftSchema>;
export type OrderDraftInput = z.input<typeof orderDraftSchema>;
export type ContactDetails = z.infer<typeof contactDetailsSchema>;
export type ContactDetailsInput = z.input<typeof contactDetailsSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
