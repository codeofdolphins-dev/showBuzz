import "server-only";
import { randomInt } from "node:crypto";
import type { GiftCardAttrs } from "@showbuzz/db/models/GiftCard";
import { GIFT_CARD_VALIDITY_DAYS } from "@showbuzz/schemas/constants";
import { GIFT_CARD_CODE_ALPHABET, GIFT_CARD_CODE_LENGTH } from "@showbuzz/schemas/gift-card";
import type { GiftCardStatus } from "@showbuzz/schemas/types/gift-card";

/**
 * Gift card code, expiry and status rules, split from gift-card.service (which reads the cached catalogue) so the
 * admin console can issue and show cards without importing "use cache" functions.
 */

/** 16 random characters from a 32-symbol alphabet: 80 bits, never guessable within the lookup limits. */
export function generateGiftCardCode(): string {
  return Array.from({ length: GIFT_CARD_CODE_LENGTH }, () =>
    GIFT_CARD_CODE_ALPHABET.charAt(randomInt(GIFT_CARD_CODE_ALPHABET.length)),
  ).join("");
}

export function giftCardExpiry(from: Date): Date {
  return new Date(from.getTime() + GIFT_CARD_VALIDITY_DAYS * 24 * 60 * 60_000);
}

/** Stored status, with an active card past its expiry shown as expired (no cron job needed). */
export function effectiveGiftCardStatus(card: Pick<GiftCardAttrs, "status" | "expiresAt">, now: Date): GiftCardStatus {
  return card.status === "active" && card.expiresAt <= now ? "expired" : card.status;
}
