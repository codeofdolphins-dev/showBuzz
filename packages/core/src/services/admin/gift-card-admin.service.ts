import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { GiftCard, type GiftCardAttrs } from "@showbuzz/db/models/GiftCard";
import { GiftCardDesign } from "@showbuzz/db/models/GiftCardDesign";
import { Staff } from "@showbuzz/db/models/Staff";
import { User } from "@showbuzz/db/models/User";
import { Types } from "@showbuzz/db/mongoose";
import { cancelGiftCardSchema, issueGiftCardSchema } from "@showbuzz/schemas/admin-platform";
import { formatGiftCardCode, normalizeGiftCardCode } from "@showbuzz/schemas/gift-card";
import type { GiftCardStatus } from "@showbuzz/schemas/types/gift-card";
import type { GiftCardDetail, GiftCardRow, Option } from "@showbuzz/schemas/types/admin-platform";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { cancelConfirmedBooking } from "../booking-cancel.service";
import { effectiveGiftCardStatus, generateGiftCardCode, giftCardExpiry } from "../gift-card-codes";
import { type AdminListQuery, idOr404, sortSpec } from "./shared";

/**
 * Gift cards in the console (prompt 7): list and details with the ledger, cancel, and complimentary cards.
 *
 * Complimentary cards have no buyer and no purchase booking (`source: complimentary`, `issue` ledger entry). Like
 * any gift card, using one to pay for tickets doesn't change the vendor's share: the platform absorbs it.
 *
 * Cancelling zeroes the remaining balance with a `cancel` ledger entry. A purchased card that was never used is
 * refunded too (agreed 2026-10-15): its purchase booking is cancelled through cancelConfirmedBooking with no fee, so
 * the buyer gets the full price back. If the refund step fails after the card was cancelled, cancelling again
 * retries it. A card that was partly spent is not refunded.
 */

export const GIFT_CARD_SORT_FIELDS = ["createdAt", "expiresAt", "balancePaise"] as const;

export interface GiftCardListQuery extends AdminListQuery {
  status?: GiftCardStatus;
  source?: "purchase" | "complimentary";
}

type LeanCard = GiftCardAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "Gift card not found.", 404);

const sourceOf = (card: LeanCard): "purchase" | "complimentary" =>
  card.source ?? (card.purchaseBookingId ? "purchase" : "complimentary");

/** Purchased online and never spent (no redeem entry; a cancelled card's zeroed balance doesn't count). */
function unused(card: LeanCard): boolean {
  return sourceOf(card) === "purchase" && !card.transactions.some((t) => t.type === "redeem");
}

function statusFilter(status: GiftCardStatus, now: Date): Record<string, unknown> {
  if (status === "expired") {
    return { $or: [{ status: "expired" }, { status: "active", expiresAt: { $lte: now } }] };
  }
  if (status === "active") return { status: "active", expiresAt: { $gt: now } };
  return { status };
}

function toRow(card: LeanCard, buyers: Map<string, string>, now: Date): GiftCardRow {
  const buyerName = card.purchaserUserId ? buyers.get(card.purchaserUserId.toString()) : undefined;
  return {
    id: card._id.toString(),
    code: formatGiftCardCode(card.code),
    source: sourceOf(card),
    amountPaise: card.amountPaise,
    balancePaise: card.balancePaise,
    status: effectiveGiftCardStatus(card, now),
    ...(buyerName ? { buyerName } : {}),
    recipientName: card.recipientName,
    expiresAt: card.expiresAt.toISOString(),
    createdAt: card.createdAt.toISOString(),
  };
}

async function buyerNames(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  if (wanted.length === 0) return new Map();
  const users = await User.find({ _id: { $in: wanted } }, { name: 1 }).lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

export async function listGiftCardsAdmin(
  query: GiftCardListQuery,
  now: Date,
): Promise<{ rows: GiftCardRow[]; total: number }> {
  await connect();
  const and: Record<string, unknown>[] = [];
  if (query.status) and.push(statusFilter(query.status, now));
  if (query.source === "complimentary") and.push({ source: "complimentary" });
  if (query.source === "purchase") and.push({ source: { $ne: "complimentary" } });
  const q = query.q.trim();
  if (q) {
    const code = normalizeGiftCardCode(q);
    const pattern = new RegExp(escapeRegex(q), "i");
    and.push({
      $or: [
        ...(code.length >= 4 ? [{ code: new RegExp(escapeRegex(code)) }] : []),
        { recipientName: pattern },
        { recipientContact: pattern },
      ],
    });
  }
  const filter = and.length > 0 ? { $and: and } : {};
  const [docs, total] = await Promise.all([
    GiftCard.find(filter)
      .sort(sortSpec(query, GIFT_CARD_SORT_FIELDS, "createdAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    GiftCard.countDocuments(filter),
  ]);
  const buyers = await buyerNames(docs.map((d) => d.purchaserUserId));
  return { rows: docs.map((d) => toRow(d, buyers, now)), total };
}

export async function getGiftCardAdmin(cardId: string, now: Date): Promise<GiftCardDetail | null> {
  const _id = idOr404(cardId, "Gift card");
  await connect();
  const card = await GiftCard.findById(_id).lean();
  if (!card) return null;
  const bookingIds = [
    ...(card.purchaseBookingId ? [card.purchaseBookingId] : []),
    ...card.transactions.flatMap((t) => (t.bookingId ? [t.bookingId] : [])),
  ];
  const staffIds = [
    ...(card.issuedByStaffId ? [card.issuedByStaffId] : []),
    ...card.transactions.flatMap((t) => (t.staffId ? [t.staffId] : [])),
  ];
  const [bookings, staff, buyer, design, purchase] = await Promise.all([
    Booking.find({ _id: { $in: bookingIds } }, { code: 1 }).lean(),
    Staff.find({ _id: { $in: staffIds } }, { name: 1 }).lean(),
    card.purchaserUserId ? User.findById(card.purchaserUserId, { name: 1, phone: 1, email: 1 }).lean() : null,
    Types.ObjectId.isValid(card.designId) ? GiftCardDesign.findById(card.designId, { name: 1 }).lean() : null,
    card.purchaseBookingId ? Booking.findById(card.purchaseBookingId, { status: 1 }).lean() : null,
  ]);
  const codes = new Map(bookings.map((b) => [b._id.toString(), b.code]));
  const names = new Map(staff.map((s) => [s._id.toString(), s.name]));
  const purchaseCode = card.purchaseBookingId ? codes.get(card.purchaseBookingId.toString()) : undefined;
  const issuedByName = card.issuedByStaffId ? names.get(card.issuedByStaffId.toString()) : undefined;
  const buyerContact = buyer?.phone ?? buyer?.email;
  const status = effectiveGiftCardStatus(card, now);
  return {
    ...toRow(card, new Map(buyer ? [[buyer._id.toString(), buyer.name]] : []), now),
    ...(design ? { designName: design.name } : {}),
    recipientContact: card.recipientContact,
    ...(card.message ? { message: card.message } : {}),
    ...(buyer ? { buyerId: buyer._id.toString() } : {}),
    ...(buyerContact ? { buyerContact } : {}),
    ...(purchaseCode ? { purchaseBookingCode: purchaseCode } : {}),
    ...(issuedByName ? { issuedByName } : {}),
    ...(card.issueReason ? { issueReason: card.issueReason } : {}),
    ...(card.cancelledAt ? { cancelledAt: card.cancelledAt.toISOString() } : {}),
    ...(card.cancelReason ? { cancelReason: card.cancelReason } : {}),
    transactions: card.transactions.map((t) => {
      const bookingCode = t.bookingId ? codes.get(t.bookingId.toString()) : undefined;
      const staffName = t.staffId ? names.get(t.staffId.toString()) : undefined;
      return {
        type: t.type,
        amountPaise: t.amountPaise,
        ...(bookingCode ? { bookingCode } : {}),
        ...(staffName ? { staffName } : {}),
        at: t.at.toISOString(),
      };
    }),
    refundOnCancel: (status === "active" || status === "cancelled") && unused(card) && purchase?.status === "confirmed",
  };
}

/** Designs for the "issue" form (the same artwork customers pick from). */
export async function listGiftCardDesignOptions(): Promise<Option[]> {
  await connect();
  const designs = await GiftCardDesign.find({}, { name: 1 }).sort({ sortOrder: 1 }).lean();
  return designs.map((d) => ({ value: d._id.toString(), label: d.name }));
}

/** A complimentary card (goodwill, prize): valid 12 months; no delivery provider yet, so staff pass the code on. */
export async function issueComplimentaryGiftCard(
  staffId: string,
  input: unknown,
  now: Date,
): Promise<{ id: string; code: string; amountPaise: number }> {
  const data = issueGiftCardSchema.parse(input);
  await connect();
  const designId = idOr404(data.designId, "Design");
  if (!(await GiftCardDesign.exists({ _id: designId }))) {
    throw new AppError("VALIDATION_FAILED", "Choose a design.", 422, { fieldErrors: { designId: ["Choose a design."] } });
  }
  const staff = new Types.ObjectId(staffId);
  for (let attempt = 1; ; attempt++) {
    try {
      const card = await GiftCard.create({
        code: generateGiftCardCode(),
        designId: designId.toString(),
        amountPaise: data.amountPaise,
        balancePaise: data.amountPaise,
        source: "complimentary",
        issuedByStaffId: staff,
        issueReason: data.reason,
        recipientName: data.recipientName,
        recipientContact: data.recipientContact,
        ...(data.message ? { message: data.message } : {}),
        status: "active",
        expiresAt: giftCardExpiry(now),
        transactions: [{ type: "issue", amountPaise: data.amountPaise, staffId: staff, at: now }],
      });
      return { id: card._id.toString(), code: formatGiftCardCode(card.code), amountPaise: card.amountPaise };
    } catch (err) {
      // A code collision (80 random bits: practically never) just draws another code.
      const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
      if (attempt < 3 && (err as { code?: number }).code === 11000 && keyPattern && "code" in keyPattern) continue;
      throw err;
    }
  }
}

export async function cancelGiftCard(
  staffId: string,
  cardId: string,
  input: unknown,
  now: Date,
): Promise<{ code: string; refundedPaise: number; zeroedPaise: number }> {
  const _id = idOr404(cardId, "Gift card");
  const { reason } = cancelGiftCardSchema.parse(input);
  await connect();
  const card = await GiftCard.findById(_id).lean();
  if (!card) throw NOT_FOUND();
  const code = formatGiftCardCode(card.code);
  const refundable = unused(card);
  let zeroedPaise = 0;

  if (card.status !== "cancelled") {
    if (effectiveGiftCardStatus(card, now) === "expired" || card.status === "redeemed") {
      throw new AppError("CONFLICT", "Only active cards can be cancelled (this one is used up or expired).", 409);
    }
    // Conditional on the balance read, so a checkout spending it at the same moment can't be overwritten.
    const staff = new Types.ObjectId(staffId);
    const result = await GiftCard.updateOne(
      { _id, status: "active", balancePaise: card.balancePaise },
      {
        $set: { status: "cancelled", balancePaise: 0, cancelledAt: now, cancelReason: reason },
        $push: { transactions: { type: "cancel", amountPaise: card.balancePaise, staffId: staff, at: now } },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new AppError("CONFLICT", "The card changed while you were looking at it. Reload and try again.", 409);
    }
    zeroedPaise = card.balancePaise;
  }

  let refundedPaise = 0;
  if (refundable && card.purchaseBookingId) {
    const booking = await Booking.findById(card.purchaseBookingId).lean();
    if (booking?.status === "confirmed") {
      const result = await cancelConfirmedBooking(booking, { feePaise: 0, by: "staff", reason, staffId, now });
      refundedPaise = result.refundPaise;
    }
  } else if (card.status === "cancelled") {
    throw new AppError("CONFLICT", "This card is already cancelled.", 409);
  }
  return { code, refundedPaise, zeroedPaise };
}
