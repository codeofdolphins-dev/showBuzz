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

/** Unambiguous alphabet (Crockford base32): no I, L, O or U, so codes survive being read aloud. */
export const GIFT_CARD_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const GIFT_CARD_CODE_LENGTH = 16;

/** Upper-cases, drops spaces and dashes, and maps look-alikes (O→0, I/L→1) so typed codes match. */
export function normalizeGiftCardCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** "ABCD1234EFGH5678" → "ABCD-1234-EFGH-5678" */
export function formatGiftCardCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export const giftCardCodeSchema = z
  .string()
  .max(40)
  .transform(normalizeGiftCardCode)
  .pipe(
    z
      .string()
      .length(GIFT_CARD_CODE_LENGTH, "Gift card codes have 16 characters")
      .regex(/^[0-9A-HJKMNP-TV-Z]+$/, "Enter a valid gift card code"),
  );
