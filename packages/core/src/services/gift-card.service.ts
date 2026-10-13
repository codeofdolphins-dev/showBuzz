import "server-only";
import { randomInt } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { GiftCard, type GiftCardAttrs } from "@showbuzz/db/models/GiftCard";
import type { Types } from "@showbuzz/db/mongoose";
import { GIFT_CARD_LOOKUP_LIMITS, GIFT_CARD_VALIDITY_DAYS } from "@showbuzz/schemas/constants";
import {
  GIFT_CARD_CODE_ALPHABET,
  GIFT_CARD_CODE_LENGTH,
  formatGiftCardCode,
  normalizeGiftCardCode,
} from "@showbuzz/schemas/gift-card";
import type { GiftCardStatus, GiftCardSummary } from "@showbuzz/schemas/types/gift-card";
import { ipPrefix } from "../http/request";
import { consumeRateLimit } from "../security/rate-limit";
import { listGiftCardDesigns } from "./catalog.service";

/**
 * Gift cards (`giftCards`). Cards are created when a gift card order's payment is confirmed (booking.service,
 * same transaction) and spent or refilled there too; this module issues codes, looks them up for checkout
 * (rate-limited) and shows cards to their buyer. Delivery to the recipient by email/SMS is not built yet (no
 * provider): the buyer sees the code on screen and passes it on.
 */

type LeanGiftCard = GiftCardAttrs & { _id: Types.ObjectId };

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

export interface GiftCardLookupContext {
  userId?: string;
  ip: string;
  now: Date;
}

export type GiftCardLookup =
  { ok: true; card: { id: Types.ObjectId; last4: string; balancePaise: number } } | { ok: false; error: string };

/**
 * Finds a usable card by code for checkout. Every lookup counts against per-user and per-IP hourly limits,
 * valid or not, so codes can't be guessed by repeated quotes. Sign-in is required to use a gift card.
 */
export async function lookupGiftCard(rawCode: string, ctx: GiftCardLookupContext): Promise<GiftCardLookup> {
  if (!ctx.userId) return { ok: false, error: "Sign in to pay with a gift card." };

  const { perUser, perIp, windowSec } = GIFT_CARD_LOOKUP_LIMITS;
  const [byUser, byIp] = await Promise.all([
    consumeRateLimit(`giftcard:user:${ctx.userId}`, { limit: perUser, windowSec, now: ctx.now }),
    consumeRateLimit(`giftcard:ip:${ipPrefix(ctx.ip) ?? ctx.ip}`, { limit: perIp, windowSec, now: ctx.now }),
  ]);
  if (!byUser.allowed || !byIp.allowed) {
    const minutes = Math.ceil(Math.max(byUser.retryAfterSec, byIp.retryAfterSec) / 60);
    return { ok: false, error: `Too many gift card attempts. Please try again in ${minutes} minutes.` };
  }

  await connect();
  const card = await GiftCard.findOne(
    { code: normalizeGiftCardCode(rawCode) },
    { code: 1, status: 1, expiresAt: 1, balancePaise: 1 },
  ).lean();
  if (!card) return { ok: false, error: "This gift card code isn't valid." };
  const status = effectiveGiftCardStatus(card, ctx.now);
  if (status === "expired") return { ok: false, error: "This gift card has expired." };
  if (status === "cancelled") return { ok: false, error: "This gift card is no longer valid." };
  if (status === "redeemed" || card.balancePaise <= 0)
    return { ok: false, error: "This gift card has no balance left." };
  return { ok: true, card: { id: card._id, last4: card.code.slice(-4), balancePaise: card.balancePaise } };
}

async function toSummaries(cards: LeanGiftCard[], now: Date): Promise<GiftCardSummary[]> {
  if (cards.length === 0) return [];
  const designs = await listGiftCardDesigns();
  return cards.map((card) => {
    const design = designs.find((d) => d.id === card.designId);
    return {
      code: formatGiftCardCode(card.code),
      ...(design ? { designName: design.name, gradient: design.gradient } : {}),
      amountPaise: card.amountPaise,
      balancePaise: card.balancePaise,
      status: effectiveGiftCardStatus(card, now),
      expiresAt: card.expiresAt.toISOString(),
      recipientName: card.recipientName,
      recipientContact: card.recipientContact,
      ...(card.message ? { message: card.message } : {}),
      purchasedAt: card.createdAt.toISOString(),
    };
  });
}

/** Cards bought by this customer, newest first (profile "My Gift Cards"). */
export async function listPurchasedGiftCards(userId: string, now: Date): Promise<GiftCardSummary[]> {
  await connect();
  const cards = await GiftCard.find({ purchaserUserId: userId }).sort({ createdAt: -1 }).limit(100).lean();
  return toSummaries(cards, now);
}

/** The cards issued by these bookings (gift card purchases), keyed by booking id. */
export async function getIssuedGiftCards(
  bookingIds: Types.ObjectId[],
  now: Date,
): Promise<Map<string, GiftCardSummary>> {
  if (bookingIds.length === 0) return new Map();
  await connect();
  const cards = await GiftCard.find({ purchaseBookingId: { $in: bookingIds } }).lean();
  const summaries = await toSummaries(cards, now);
  const issued = new Map<string, GiftCardSummary>();
  cards.forEach((card, i) => {
    const summary = summaries[i];
    if (summary) issued.set(card.purchaseBookingId.toString(), summary);
  });
  return issued;
}
