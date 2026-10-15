import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { GiftCard } from "@showbuzz/db/models/GiftCard";
import { Review } from "@showbuzz/db/models/Review";
import { User, type UserAttrs } from "@showbuzz/db/models/User";
import type { PipelineStage, Types } from "@showbuzz/db/mongoose";
import { blockCustomerSchema } from "@showbuzz/schemas/admin-platform";
import type { UserStatus } from "@showbuzz/schemas/user";
import type { CustomerDetail, CustomerRow } from "@showbuzz/schemas/types/admin-platform";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, idOr404 } from "./shared";

/**
 * Customers (prompt 7): the `users` collection with booking totals across every vendor. Staff see full contact
 * details (platform support). Blocking signs the customer out everywhere and stops sign-in (the OTP flow and every
 * session check require `status: active`); their bookings stay valid. Deleted (anonymised) accounts are read-only.
 */

export const CUSTOMER_SORT_FIELDS = ["name", "createdAt", "orders", "spend"] as const;

export interface CustomerListQuery extends AdminListQuery {
  status?: UserStatus;
}

type LeanUser = Omit<UserAttrs, "sessions"> & { _id: Types.ObjectId };
interface Stats {
  orders: number;
  spendPaise: number;
}

/** Orders = confirmed or cancelled (sold at some point); spend = what is still paid on confirmed ones. */
const SOLD = ["confirmed", "cancelled"];

async function statsFor(userIds: Types.ObjectId[]): Promise<Map<string, Stats>> {
  if (userIds.length === 0) return new Map();
  const rows = await Booking.aggregate<{ _id: Types.ObjectId } & Stats>([
    { $match: { userId: { $in: userIds }, status: { $in: SOLD } } },
    {
      $group: {
        _id: "$userId",
        orders: { $sum: 1 },
        spendPaise: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$amounts.totalPaise", 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), { orders: r.orders, spendPaise: r.spendPaise }]));
}

function toRow(doc: LeanUser, stats: Stats | undefined): CustomerRow {
  return {
    id: doc._id.toString(),
    name: doc.name,
    ...(doc.phone ? { phone: doc.phone } : {}),
    ...(doc.email ? { email: doc.email } : {}),
    status: doc.status,
    joinedAt: doc.createdAt.toISOString(),
    ...(doc.lastLoginAt ? { lastLoginAt: doc.lastLoginAt.toISOString() } : {}),
    orders: stats?.orders ?? 0,
    spendPaise: stats?.spendPaise ?? 0,
  };
}

function userFilter(query: CustomerListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const q = query.q.trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    filter.$or = [
      { name: pattern },
      { email: pattern },
      ...(digits.length >= 3 ? [{ phone: new RegExp(escapeRegex(digits)) }] : []),
    ];
  }
  return filter;
}

const PROJECTION = { sessions: 0 } as const;

export async function listCustomers(query: CustomerListQuery): Promise<{ rows: CustomerRow[]; total: number }> {
  await connect();
  const filter = userFilter(query);
  const direction = query.sort.direction === "asc" ? 1 : -1;
  const total = await User.countDocuments(filter);

  if (query.sort.field === "orders" || query.sort.field === "spend") {
    // Sorting by booking totals needs them for every matching customer: one $lookup over the userId index.
    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: Booking.collection.name,
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$uid"] }, status: { $in: SOLD } } },
            { $project: { status: 1, total: "$amounts.totalPaise" } },
          ],
          as: "sold",
        },
      },
      {
        $addFields: {
          orders: { $size: "$sold" },
          spendPaise: {
            $sum: {
              $map: { input: "$sold", as: "b", in: { $cond: [{ $eq: ["$$b.status", "confirmed"] }, "$$b.total", 0] } },
            },
          },
        },
      },
      { $sort: { [query.sort.field === "orders" ? "orders" : "spendPaise"]: direction, _id: 1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit },
      { $project: { sessions: 0, sold: 0 } },
    ];
    const docs = await User.aggregate<LeanUser & Stats>(pipeline);
    return { rows: docs.map((d) => toRow(d, d)), total };
  }

  const field = query.sort.field === "name" ? "name" : "createdAt";
  const docs = await User.find(filter, PROJECTION)
    .sort({ [field]: direction, _id: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const stats = await statsFor(docs.map((d) => d._id));
  return { rows: docs.map((d) => toRow(d, stats.get(d._id.toString()))), total };
}

export async function getCustomerDetail(customerId: string, now: Date): Promise<CustomerDetail | null> {
  const _id = idOr404(customerId, "Customer");
  await connect();
  const doc = await User.findById(_id).lean();
  if (!doc) return null;
  const [stats, reviews, giftCardsBought] = await Promise.all([
    statsFor([_id]),
    Review.countDocuments({ userId: _id }),
    GiftCard.countDocuments({ purchaserUserId: _id }),
  ]);
  return {
    ...toRow(doc, stats.get(customerId)),
    ...(doc.blockedAt ? { blockedAt: doc.blockedAt.toISOString() } : {}),
    ...(doc.blockReason ? { blockReason: doc.blockReason } : {}),
    ...(doc.deletedAt ? { deletedAt: doc.deletedAt.toISOString() } : {}),
    activeSessions: doc.sessions.filter((s) => s.expiresAt > now).length,
    reviews,
    giftCardsBought,
  };
}

/** Blocks an active customer: signs them out everywhere and stops sign-in. */
export async function blockCustomer(customerId: string, input: unknown, now: Date): Promise<{ name: string }> {
  const _id = idOr404(customerId, "Customer");
  const { reason } = blockCustomerSchema.parse(input);
  await connect();
  const result = await User.findOneAndUpdate(
    { _id, status: "active" },
    // Emptying sessions[] signs them out everywhere (the admin app has no customer token keys, so it doesn't use the
    // customer session store); every session check also requires status active.
    { $set: { status: "blocked", blockedAt: now, blockReason: reason, sessions: [] } },
    { projection: { name: 1 }, lean: true },
  );
  if (!result) throw await statusConflict(_id, "active");
  return { name: result.name };
}

export async function unblockCustomer(customerId: string): Promise<{ name: string }> {
  const _id = idOr404(customerId, "Customer");
  await connect();
  const result = await User.findOneAndUpdate(
    { _id, status: "blocked" },
    { $set: { status: "active" }, $unset: { blockedAt: 1, blockReason: 1 } },
    { projection: { name: 1 }, lean: true },
  );
  if (!result) throw await statusConflict(_id, "blocked");
  return { name: result.name };
}

async function statusConflict(_id: Types.ObjectId, expected: UserStatus): Promise<AppError> {
  const doc = await User.findById(_id, { status: 1 }).lean();
  if (!doc) return new AppError("NOT_FOUND", "Customer not found.", 404);
  if (doc.status === "deleted") return new AppError("CONFLICT", "This account was deleted by the customer.", 409);
  return new AppError(
    "CONFLICT",
    expected === "active" ? "This customer is already blocked." : "This customer isn't blocked.",
    409,
  );
}
