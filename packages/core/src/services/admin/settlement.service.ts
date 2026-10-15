import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import { Settlement, type SettlementAttrs } from "@showbuzz/db/models/Settlement";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { type ClientSession, Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import { paymentReferenceSchema, settlementRangeSchema, voidReasonSchema } from "@showbuzz/schemas/admin-marketplace";
import type {
  SettlementDetail,
  SettlementLine,
  SettlementPreview,
  SettlementRow,
  SettlementTotals,
} from "@showbuzz/schemas/types/admin-marketplace";
import { maskAccountNumber } from "@showbuzz/schemas/vendor";
import { addDaysToKey, formatDateShort, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { AppError } from "../../http/app-error";
import { notify } from "../notification.service";
import {
  type AdminListQuery,
  idOr404,
  nextMonthlyCode,
  optionalId,
  sortSpec,
  vendorNames,
  withCodeRetry,
} from "./shared";

/**
 * Vendor payouts. Rules (agreed 2026-10-14):
 *
 * - A payout covers a vendor's confirmed bookings not yet in a payout whose **show date** falls in the period
 *   (purchase date for passes without a start), and only shows that have already started: a ticket for a later
 *   show waits for a later payout, so cancellations rarely need clawing back.
 * - Online bookings were paid to the platform: the vendor is owed its share (sales − discount − commission).
 *   Counter sales were paid to the vendor: it owes the commission (its line is −commission).
 * - Cancellation fees on online bookings stay with the platform (it refunded its own convenience fee and bears
 *   gateway costs); a cancelled booking earns the vendor nothing. Counter cancellations are refunded at the counter.
 * - A booking cancelled after a payout included it is clawed back in the vendor's next payout (its earlier line
 *   reversed), whatever that payout's period.
 * - The net may be negative (the vendor owes the platform): it is shown as such and "paid" means received.
 *
 * Creating a payout re-reads the bookings inside a transaction and links each one conditionally (still confirmed /
 * cancelled and not yet linked); the totals must match what the admin previewed, so a booking that changed in
 * between makes the save fail with "preview again" instead of paying a different amount.
 */

export const SETTLEMENT_SORT_FIELDS = ["createdAt", "netPayoutPaise", "periodTo"] as const;
const PREVIEW_LINE_LIMIT = 300;

export interface SettlementListQuery extends AdminListQuery {
  vendorId?: string;
  status?: "pending" | "paid" | "void";
}

type LeanSettlement = LeanDoc<SettlementAttrs>;
type LineBooking = Pick<
  BookingAttrs,
  "code" | "title" | "startsAt" | "confirmedAt" | "createdAt" | "channel" | "status" | "amounts" | "settlement"
> & { _id: Types.ObjectId };

const LINE_FIELDS = {
  code: 1,
  title: 1,
  startsAt: 1,
  confirmedAt: 1,
  createdAt: 1,
  channel: 1,
  status: 1,
  amounts: 1,
  settlement: 1,
} as const;

/** Exclusive end of the period: midnight IST after `toDate`, but never later than now (only past shows). */
function periodBounds(fromDate: string, toDate: string, now: Date) {
  const from = istDateTime(fromDate, "00:00");
  const to = istDateTime(addDaysToKey(toDate, 1), "00:00");
  return { from, to, end: to < now ? to : now };
}

function payoutFilter(vendorId: Types.ObjectId, from: Date, end: Date) {
  return {
    vendorId,
    status: "confirmed" as const,
    settlementId: { $exists: false },
    $or: [
      { startsAt: { $gte: from, $lt: end } },
      { startsAt: { $exists: false }, confirmedAt: { $gte: from, $lt: end } },
    ],
  };
}

function clawbackFilter(vendorId: Types.ObjectId) {
  return {
    vendorId,
    status: "cancelled" as const,
    settlementId: { $exists: true },
    clawbackSettlementId: { $exists: false },
  };
}

/** Money of one booking as a payout line. `clawback` reverses what the earlier payout counted. */
function toLine(b: LineBooking, clawback: boolean): SettlementLine {
  const subtotal = b.settlement?.subtotalPaise ?? b.amounts.ticketsPaise + (b.amounts.foodPaise ?? 0);
  const discount = b.settlement?.discountPaise ?? b.amounts.discountPaise ?? 0;
  const netSales = Math.max(0, subtotal - discount);
  const commission = b.settlement?.commissionPaise ?? 0;
  const share = b.settlement?.vendorSharePaise ?? netSales - commission;
  const channel = b.channel === "counter" ? "counter" : "online";
  const owed = channel === "counter" ? share - netSales : share;
  return {
    bookingId: b._id.toString(),
    code: b.code,
    title: b.title,
    date: (b.startsAt ?? b.confirmedAt ?? b.createdAt).toISOString(),
    channel,
    status: b.status,
    netSalesPaise: netSales,
    commissionPaise: commission,
    vendorSharePaise: share,
    payoutPaise: clawback ? -owed : owed,
  };
}

function totalsOf(lines: SettlementLine[], clawbacks: SettlementLine[]): SettlementTotals {
  const totals: SettlementTotals = {
    bookings: lines.length,
    clawbacks: clawbacks.length,
    grossSalesPaise: 0,
    commissionPaise: 0,
    counterCollectedPaise: 0,
    refundsPaise: 0,
    netPayoutPaise: 0,
  };
  for (const l of lines) {
    totals.grossSalesPaise += l.netSalesPaise;
    totals.commissionPaise += l.commissionPaise;
    if (l.channel === "counter") totals.counterCollectedPaise += l.netSalesPaise;
  }
  // A clawback's line is the reversal; the adjustment is what is taken back (negative = given back).
  for (const c of clawbacks) totals.refundsPaise -= c.payoutPaise;
  totals.netPayoutPaise =
    totals.grossSalesPaise - totals.commissionPaise - totals.counterCollectedPaise - totals.refundsPaise;
  return totals;
}

async function readCandidates(
  vendorId: Types.ObjectId,
  from: Date,
  end: Date,
  session?: ClientSession,
): Promise<{ lines: SettlementLine[]; clawbacks: SettlementLine[] }> {
  const [included, reversed] = await Promise.all([
    Booking.find(payoutFilter(vendorId, from, end), LINE_FIELDS)
      .sort({ startsAt: 1, confirmedAt: 1 })
      .session(session ?? null)
      .lean(),
    Booking.find(clawbackFilter(vendorId), LINE_FIELDS)
      .sort({ cancelledAt: 1 })
      .session(session ?? null)
      .lean(),
  ]);
  return {
    lines: included.map((b) => toLine(b, false)),
    clawbacks: reversed.map((b) => toLine(b, true)),
  };
}

async function loadVendor(vendorId: Types.ObjectId) {
  const vendor = await Vendor.findById(vendorId, { businessName: 1, billingModel: 1, kyc: 1 }).lean();
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  return vendor;
}

export async function previewSettlement(input: unknown, now: Date): Promise<SettlementPreview> {
  const range = settlementRangeSchema.parse(input);
  const vendorId = new Types.ObjectId(range.vendorId);
  await connect();
  const vendor = await loadVendor(vendorId);
  const { from, end } = periodBounds(range.fromDate, range.toDate, now);
  const { lines, clawbacks } = await readCandidates(vendorId, from, end);
  return {
    vendorId: range.vendorId,
    vendorName: vendor.businessName,
    billingModel: vendor.billingModel,
    fromDate: range.fromDate,
    toDate: range.toDate,
    totals: totalsOf(lines, clawbacks),
    lines: lines.slice(0, PREVIEW_LINE_LIMIT),
    clawbackLines: clawbacks.slice(0, PREVIEW_LINE_LIMIT),
    truncated: lines.length > PREVIEW_LINE_LIMIT || clawbacks.length > PREVIEW_LINE_LIMIT,
  };
}

const CHANGED = () =>
  new AppError(
    "CONFLICT",
    "Bookings changed since the preview (a sale, cancellation or another payout). Preview again.",
    409,
  );

/**
 * Creates a pending payout from exactly the bookings the admin previewed (`expected` = the preview's counts and
 * net), linking each booking in the same transaction.
 */
export async function createSettlement(
  input: unknown,
  expected: { bookings: number; clawbacks: number; netPayoutPaise: number },
  staffId: string,
  now: Date,
): Promise<{ id: string; code: string; vendorId: string; netPayoutPaise: number }> {
  const range = settlementRangeSchema.parse(input);
  const vendorId = new Types.ObjectId(range.vendorId);
  const mongoose = await connect();
  await loadVendor(vendorId);
  const { from, end } = periodBounds(range.fromDate, range.toDate, now);
  const month = istDateKey(now).slice(0, 7);

  return withCodeRetry(async () => {
    const id = new Types.ObjectId();
    let created: { code: string; netPayoutPaise: number } | undefined;
    await mongoose.connection.transaction(async (session) => {
      const { lines, clawbacks } = await readCandidates(vendorId, from, end, session);
      if (lines.length === 0 && clawbacks.length === 0) {
        throw new AppError("VALIDATION_FAILED", "There is nothing to pay out for this vendor and period.", 422);
      }
      const totals = totalsOf(lines, clawbacks);
      if (
        totals.bookings !== expected.bookings ||
        totals.clawbacks !== expected.clawbacks ||
        totals.netPayoutPaise !== expected.netPayoutPaise
      ) {
        throw CHANGED();
      }
      const bookingIds = lines.map((l) => new Types.ObjectId(l.bookingId));
      const clawbackBookingIds = clawbacks.map((l) => new Types.ObjectId(l.bookingId));
      const code = await nextMonthlyCode(Settlement, "SET", month);
      await Settlement.create(
        [
          {
            _id: id,
            vendorId,
            code,
            periodFrom: from,
            periodTo: istDateTime(addDaysToKey(range.toDate, 1), "00:00"),
            bookingIds,
            clawbackBookingIds,
            grossSalesPaise: totals.grossSalesPaise,
            commissionPaise: totals.commissionPaise,
            counterCollectedPaise: totals.counterCollectedPaise,
            refundsPaise: totals.refundsPaise,
            netPayoutPaise: totals.netPayoutPaise,
            status: "pending",
            createdBy: new Types.ObjectId(staffId),
          },
        ],
        { session },
      );
      if (bookingIds.length > 0) {
        const linked = await Booking.updateMany(
          { _id: { $in: bookingIds }, status: "confirmed", settlementId: { $exists: false } },
          { $set: { settlementId: id } },
          { session },
        );
        if (linked.modifiedCount !== bookingIds.length) throw CHANGED();
      }
      if (clawbackBookingIds.length > 0) {
        const linked = await Booking.updateMany(
          { _id: { $in: clawbackBookingIds }, status: "cancelled", clawbackSettlementId: { $exists: false } },
          { $set: { clawbackSettlementId: id } },
          { session },
        );
        if (linked.modifiedCount !== clawbackBookingIds.length) throw CHANGED();
      }
      created = { code, netPayoutPaise: totals.netPayoutPaise };
    });
    if (!created) throw new Error("Settlement transaction finished without a result");
    log.info("Vendor payout created", { event: "settlement.created", settlementId: id.toString() });
    return { id: id.toString(), code: created.code, vendorId: range.vendorId, netPayoutPaise: created.netPayoutPaise };
  });
}

export async function markSettlementPaid(
  settlementId: string,
  input: unknown,
  staffId: string,
  now: Date,
): Promise<{ code: string; vendorId: string }> {
  const _id = idOr404(settlementId, "Payout");
  const { reference } = paymentReferenceSchema.parse(input);
  await connect();
  const doc = await Settlement.findOneAndUpdate(
    { _id, status: "pending" },
    { $set: { status: "paid", reference, paidAt: now, paidBy: new Types.ObjectId(staffId) } },
    { projection: { code: 1, vendorId: 1, netPayoutPaise: 1, periodFrom: 1, periodTo: 1 } },
  ).lean();
  if (!doc) throw await settlementConflict(_id);
  const net = doc.netPayoutPaise;
  // periodTo is the exclusive end (midnight after the last day).
  const cycle = `${formatDateShort(doc.periodFrom)} – ${formatDateShort(new Date(doc.periodTo.getTime() - 1))}`;
  await notify({
    audience: "vendor",
    vendorId: doc.vendorId.toString(),
    type: "payout_paid",
    title:
      net < 0
        ? `Payout ${doc.code}: your payment of ${formatINR(-net, { exact: true })} was received`
        : `Payout ${doc.code} of ${formatINR(net, { exact: true })} was paid`,
    body: `Settlement cycle ${cycle}. Reference ${reference}.`,
    link: "/earnings",
  });
  return { code: doc.code, vendorId: doc.vendorId.toString() };
}

/** Voids a pending payout (created in error): its bookings are released so another payout can include them. */
export async function voidSettlement(
  settlementId: string,
  input: unknown,
  now: Date,
): Promise<{ code: string; vendorId: string }> {
  const _id = idOr404(settlementId, "Payout");
  const { reason } = voidReasonSchema.parse(input);
  const mongoose = await connect();
  let result: { code: string; vendorId: string } | undefined;
  await mongoose.connection.transaction(async (session) => {
    const doc = await Settlement.findOneAndUpdate(
      { _id, status: "pending" },
      [
        {
          $set: {
            status: "void",
            voidedAt: now,
            voidReason: reason,
            voidedBookingIds: "$bookingIds",
            voidedClawbackBookingIds: "$clawbackBookingIds",
            bookingIds: [],
            clawbackBookingIds: [],
          },
        },
      ],
      { session, updatePipeline: true, projection: { code: 1, vendorId: 1 } },
    ).lean();
    if (!doc) throw await settlementConflict(_id);
    await Booking.updateMany({ settlementId: _id }, { $unset: { settlementId: 1 } }, { session });
    await Booking.updateMany({ clawbackSettlementId: _id }, { $unset: { clawbackSettlementId: 1 } }, { session });
    result = { code: doc.code, vendorId: doc.vendorId.toString() };
  });
  if (!result) throw new Error("Void transaction finished without a result");
  return result;
}

async function settlementConflict(_id: Types.ObjectId): Promise<AppError> {
  const doc = await Settlement.findById(_id, { status: 1 }).lean();
  return doc
    ? new AppError("CONFLICT", `This payout is already ${doc.status === "void" ? "voided" : doc.status}. Reload.`, 409)
    : new AppError("NOT_FOUND", "Payout not found.", 404);
}

export function toSettlementRow(doc: LeanSettlement, names: Map<string, string>): SettlementRow {
  const lastDay = new Date(doc.periodTo.getTime() - 1);
  return {
    id: doc._id.toString(),
    code: doc.code,
    vendorId: doc.vendorId.toString(),
    vendorName: names.get(doc.vendorId.toString()) ?? "Removed vendor",
    periodFrom: doc.periodFrom.toISOString(),
    periodFromKey: istDateKey(doc.periodFrom),
    periodToKey: istDateKey(lastDay),
    bookings: (doc.status === "void" ? doc.voidedBookingIds : doc.bookingIds)?.length ?? 0,
    grossSalesPaise: doc.grossSalesPaise,
    commissionPaise: doc.commissionPaise,
    counterCollectedPaise: doc.counterCollectedPaise ?? 0,
    refundsPaise: doc.refundsPaise,
    netPayoutPaise: doc.netPayoutPaise,
    status: doc.status,
    ...(doc.reference ? { reference: doc.reference } : {}),
    ...(doc.paidAt ? { paidAt: doc.paidAt.toISOString() } : {}),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listSettlements(
  query: SettlementListQuery,
): Promise<{ rows: SettlementRow[]; total: number; pendingTotalPaise: number }> {
  const filter: Record<string, unknown> = {};
  const vendorId = optionalId(query.vendorId);
  if (vendorId) filter.vendorId = vendorId;
  if (query.status) filter.status = query.status;
  if (query.q.trim())
    filter.code = new RegExp(
      `^${query.q
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")}`,
    );
  await connect();
  const [docs, total, pending] = await Promise.all([
    Settlement.find(filter)
      .sort(sortSpec(query, SETTLEMENT_SORT_FIELDS, "createdAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Settlement.countDocuments(filter),
    Settlement.aggregate<{ total: number }>([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$netPayoutPaise" } } },
    ]),
  ]);
  const names = await vendorNames(docs.map((d) => d.vendorId));
  return {
    rows: docs.map((d) => toSettlementRow(d, names)),
    total,
    pendingTotalPaise: pending[0]?.total ?? 0,
  };
}

export async function getSettlement(settlementId: string): Promise<SettlementDetail | null> {
  const _id = optionalId(settlementId);
  if (!_id) return null;
  await connect();
  const doc = await Settlement.findById(_id).lean();
  if (!doc) return null;
  const vendor = await Vendor.findById(doc.vendorId, { businessName: 1, billingModel: 1, kyc: 1 }).lean();
  const void_ = doc.status === "void";
  const ids = void_ ? doc.voidedBookingIds : doc.bookingIds;
  const clawbackIds = void_ ? doc.voidedClawbackBookingIds : doc.clawbackBookingIds;
  const [included, reversed] = await Promise.all([
    Booking.find({ _id: { $in: ids } }, LINE_FIELDS)
      .sort({ startsAt: 1 })
      .lean(),
    Booking.find({ _id: { $in: clawbackIds } }, LINE_FIELDS).lean(),
  ]);
  const bank = vendor?.kyc.bankAccount;
  return {
    ...toSettlementRow(doc, new Map([[doc.vendorId.toString(), vendor?.businessName ?? "Removed vendor"]])),
    bookings: ids.length,
    billingModel: vendor?.billingModel ?? "commission",
    bankAccount: {
      holderName: bank?.holderName ?? "",
      accountNumberMasked: bank?.accountNumber ? maskAccountNumber(bank.accountNumber) : "",
      ifsc: bank?.ifsc ?? "",
    },
    lines: included.map((b) => toLine(b, false)),
    clawbackLines: reversed.map((b) => toLine(b, true)),
    ...(doc.voidReason ? { voidReason: doc.voidReason } : {}),
  };
}

/** The last IST day a payout may cover (yesterday): today's later shows haven't happened yet. */
export function defaultPayoutRange(now: Date): { fromDate: string; toDate: string } {
  const today = istDateKey(now);
  return { fromDate: addDaysToKey(today, -15), toDate: addDaysToKey(today, -1) };
}
