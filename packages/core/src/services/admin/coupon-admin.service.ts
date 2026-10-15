import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Coupon, type CouponAttrs } from "@showbuzz/db/models/Coupon";
import type { Types } from "@showbuzz/db/mongoose";
import { type PlatformCouponInput, platformCouponInputSchema } from "@showbuzz/schemas/admin-platform";
import type { AdminCouponRow } from "@showbuzz/schemas/types/admin-platform";
import { formatINR } from "@showbuzz/utils/money";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, changedKeys, idOr404, isDuplicateKey, searchPattern, sortSpec, vendorNames } from "./shared";

/**
 * Platform coupons (prompt 7): the coupons without a vendor, valid on every show and always listed on /offers.
 * Staff edit them in full, including usage limits; vendor coupons are listed read-only (vendors manage their own).
 * Coupons are switched off, never deleted (bookings refer to them by code), and a code can't change once used.
 */

export const ADMIN_COUPON_SORT_FIELDS = ["code", "validUntil", "usedCount"] as const;

export interface AdminCouponListQuery extends AdminListQuery {
  owner?: "platform" | "vendor";
  status?: "active" | "inactive" | "expired";
}

type LeanCoupon = CouponAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "Coupon not found (vendor coupons are edited by their vendor).", 404);
const CODE_TAKEN = () =>
  new AppError("CONFLICT", "This code is already in use on ShowBuzz. Choose another.", 409, {
    fieldErrors: { code: ["This code is already in use. Choose another."] },
  });

function discountLabel(doc: LeanCoupon): string {
  if (doc.kind === "bogo") return "Buy 1 get 1";
  if (doc.kind === "percent") {
    const pct = `${(doc.percentBps ?? 0) / 100}%`;
    return doc.maxDiscountPaise ? `${pct} up to ${formatINR(doc.maxDiscountPaise)}` : pct;
  }
  return `${formatINR(doc.flatPaise ?? 0)} off`;
}

function statusOf(doc: LeanCoupon, now: Date): AdminCouponRow["status"] {
  if (doc.status === "inactive") return "inactive";
  return doc.validUntil < now ? "expired" : "active";
}

export async function listCouponsAdmin(
  query: AdminCouponListQuery,
  now: Date,
): Promise<{ rows: AdminCouponRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.owner === "platform") filter.vendorId = null;
  if (query.owner === "vendor") filter.vendorId = { $ne: null };
  if (query.status === "inactive") filter.status = "inactive";
  if (query.status === "active") Object.assign(filter, { status: { $ne: "inactive" }, validUntil: { $gte: now } });
  if (query.status === "expired") Object.assign(filter, { status: { $ne: "inactive" }, validUntil: { $lt: now } });
  if (query.q.trim()) filter.$or = [{ code: searchPattern(query.q) }, { title: searchPattern(query.q) }];
  const [docs, total] = await Promise.all([
    Coupon.find(filter)
      .sort(sortSpec(query, ADMIN_COUPON_SORT_FIELDS, "code"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Coupon.countDocuments(filter),
  ]);
  const vendors = await vendorNames(docs.map((d) => d.vendorId));
  return {
    rows: docs.map((d) => {
      const vendorName = d.vendorId ? (vendors.get(d.vendorId.toString()) ?? "Vendor") : undefined;
      return {
        id: d._id.toString(),
        code: d.code,
        title: d.title,
        ...(vendorName ? { vendorName } : {}),
        discountLabel: discountLabel(d),
        minOrderPaise: d.minOrderPaise,
        usedCount: d.usedCount ?? 0,
        ...(d.usageLimit !== undefined ? { usageLimit: d.usageLimit } : {}),
        validUntil: d.validUntil.toISOString(),
        status: statusOf(d, now),
      };
    }),
    total,
  };
}

function toValues(doc: LeanCoupon): PlatformCouponInput {
  return {
    code: doc.code,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    kind: doc.kind,
    ...(doc.percentBps !== undefined ? { percentOff: doc.percentBps / 100 } : {}),
    ...(doc.flatPaise !== undefined ? { flatPaise: doc.flatPaise } : {}),
    ...(doc.maxDiscountPaise !== undefined ? { maxDiscountPaise: doc.maxDiscountPaise } : {}),
    minOrderPaise: doc.minOrderPaise,
    appliesTo: doc.appliesTo,
    eligibleFormats: [...(doc.eligibleFormats ?? [])],
    ...(doc.minTickets !== undefined ? { minTickets: doc.minTickets } : {}),
    weekendOnly: doc.weekendOnly === true,
    bank: doc.bank ?? "",
    validFrom: doc.validFrom?.toISOString() ?? "",
    validUntil: doc.validUntil.toISOString(),
    ...(doc.usageLimit !== undefined ? { usageLimit: doc.usageLimit } : {}),
    ...(doc.perCustomerLimit !== undefined ? { perCustomerLimit: doc.perCustomerLimit } : {}),
    icon: doc.icon,
    gradient: doc.gradient,
    terms: [...doc.terms],
    status: doc.status ?? "active",
  };
}

export async function getPlatformCoupon(
  couponId: string,
): Promise<{ values: PlatformCouponInput; usedCount: number } | null> {
  const _id = idOr404(couponId, "Coupon");
  await connect();
  const doc = await Coupon.findOne({ _id, vendorId: null }).lean();
  return doc ? { values: toValues(doc), usedCount: doc.usedCount ?? 0 } : null;
}

function toStored(input: unknown) {
  const data = platformCouponInputSchema.parse(input);
  const percent = data.kind === "percent";
  const stored = {
    code: data.code,
    title: data.title,
    category: data.category,
    description: data.description,
    kind: data.kind,
    percentBps: percent && data.percentOff !== undefined ? Math.round(data.percentOff * 100) : undefined,
    flatPaise: data.kind === "flat" ? data.flatPaise : undefined,
    // A flat discount is its own maximum.
    maxDiscountPaise: data.kind === "flat" ? undefined : data.maxDiscountPaise,
    minOrderPaise: data.minOrderPaise,
    appliesTo: data.appliesTo,
    eligibleFormats: data.eligibleFormats.length > 0 ? [...new Set(data.eligibleFormats)] : undefined,
    minTickets: data.minTickets,
    weekendOnly: data.weekendOnly || undefined,
    bank: data.bank || undefined,
    validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
    validUntil: new Date(data.validUntil),
    usageLimit: data.usageLimit,
    perCustomerLimit: data.perCustomerLimit,
    icon: data.icon,
    gradient: data.gradient,
    terms: data.terms,
    status: data.status,
  };
  const set = Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== undefined));
  const unset = Object.fromEntries(
    Object.entries(stored)
      .filter(([, v]) => v === undefined)
      .map(([k]) => [k, 1]),
  );
  return { data, set, unset };
}

export async function createPlatformCoupon(input: unknown): Promise<{ id: string; code: string }> {
  const { set } = toStored(input);
  await connect();
  const last = await Coupon.findOne({ vendorId: null }, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  try {
    const doc = await Coupon.create({ ...set, vendorId: null, usedCount: 0, sortOrder: (last?.sortOrder ?? 0) + 1 });
    return { id: doc._id.toString(), code: doc.code };
  } catch (err) {
    if (isDuplicateKey(err)) throw CODE_TAKEN();
    throw err;
  }
}

export async function updatePlatformCoupon(
  couponId: string,
  input: unknown,
): Promise<{ code: string; changedFields: string[] }> {
  const _id = idOr404(couponId, "Coupon");
  const { data, set, unset } = toStored(input);
  await connect();
  const before = await Coupon.findOne({ _id, vendorId: null }).lean();
  if (!before) throw NOT_FOUND();
  if (before.code !== data.code && (before.usedCount ?? 0) > 0) {
    throw new AppError("VALIDATION_FAILED", "The code can't change once it has been used.", 422, {
      fieldErrors: { code: ["The code can't change once it has been used."] },
    });
  }
  try {
    await Coupon.updateOne(
      { _id, vendorId: null },
      { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
    );
  } catch (err) {
    if (isDuplicateKey(err)) throw CODE_TAKEN();
    throw err;
  }
  return { code: data.code, changedFields: changedKeys({ ...toValues(before) }, { ...data }) };
}

export async function setPlatformCouponStatus(couponId: string, status: "active" | "inactive"): Promise<{ code: string }> {
  const _id = idOr404(couponId, "Coupon");
  await connect();
  const doc = await Coupon.findOneAndUpdate(
    { _id, vendorId: null },
    { $set: { status } },
    { projection: { code: 1 }, lean: true },
  );
  if (!doc) throw NOT_FOUND();
  return { code: doc.code };
}
