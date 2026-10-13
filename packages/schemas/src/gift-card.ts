import { z } from "zod";
import { GIFT_CARD_LIMITS } from "./constants";
import { idSchema, personNameSchema } from "./common";

export const giftCardDesignSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Tailwind gradient stops, e.g. "from-rose-500 to-purple-600". */
  gradient: z.string(),
});

export const giftCardOrderSchema = z.object({
  amountPaise: z
    .int()
    .min(GIFT_CARD_LIMITS.minPaise, "Minimum gift amount is ₹250")
    .max(GIFT_CARD_LIMITS.maxPaise, "Maximum gift amount is ₹10,000"),
  designId: idSchema,
  recipientName: personNameSchema,
  recipientContact: z
    .string()
    .trim()
    .min(1, "Enter an email or mobile number")
    .refine(
      (v) => z.email().safeParse(v).success || /^(\+91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")),
      "Enter a valid email or 10-digit mobile number",
    ),
  message: z.string().trim().max(200).optional(),
});

export type GiftCardDesign = z.infer<typeof giftCardDesignSchema>;
export type GiftCardOrderInput = z.infer<typeof giftCardOrderSchema>;
