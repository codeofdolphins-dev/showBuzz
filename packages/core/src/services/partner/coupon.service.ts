import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Coupon, type CouponAttrs } from "@showbuzz/db/models/Coupon";
import { Event } from "@showbuzz/db/models/Event";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { Venue } from "@showbuzz/db/models/Venue";
import { VendorMovie } from "@showbuzz/db/models/VendorMovie";
import { Movie } from "@showbuzz/db/models/Movie";
import { Types } from "@showbuzz/db/mongoose";
import { type VendorCouponValues, vendorCouponInputSchema } from "@showbuzz/schemas/partner-box-office";
import type { VendorCouponRow } from "@showbuzz/schemas/types/partner-box-office";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { changedKeys, isDuplicateKey, toObjectId } from "./ids";

/**
 * The vendor's own coupons (valid only on its shows; pricing checks the vendor, scope, dates, status and usage
 * limits). Scoped to the session's vendor id: another vendor's coupon answers 404, and scope lists accept only the
 * vendor's own venues, films on its list and listings. Coupons are switched off (`status: inactive`), never deleted:
 * bookings refer to them by code, so the code can't change once it has been used.
 */

export const COUPON_SORT_FIELDS = ["code", "validUntil", "usedCount"] as const;

export type CouponPhase = VendorCouponRow["phase"];

export interface CouponListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  phase?: CouponPhase;
}

export interface CouponScopeOptions {
  venues: { value: string; label: string }[];
  movies: { value: string; label: string }[];
  events: { value: string; label: string }[];
}

const NOT_FOUND = () => new AppError("NOT_FOUND", "This coupon doesn't exist or isn't yours.", 404);

function vendorObjectId(vendorId: string): Types.ObjectId {
  const id = toObjectId(vendorId);
  if (!id) throw NOT_FOUND();
  return id;
}

function phaseOf(doc: LeanDoc<CouponAttrs>, now: Date): CouponPhase {
  if (doc.status === "inactive") return "inactive";
  if (doc.validUntil < now) return "expired";
  if (doc.usageLimit !== undefined && (doc.usedCount ?? 0) >= doc.usageLimit) return "used_up";
  if (doc.validFrom && doc.validFrom > now) return "scheduled";
  return "live";
}

/** Mongo filter for one phase (the same rules as `phaseOf`). */
function phaseFilter(phase: CouponPhase, now: Date): Record<string, unknown> {
  const active = { status: { $ne: "inactive" } };
  const usedUp = {
    $expr: { $gte: [{ $ifNull: ["$usedCount", 0] }, { $ifNull: ["$usageLimit", Number.MAX_SAFE_INTEGER] }] },
  };
  const notUsedUp = {
    $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, { $ifNull: ["$usageLimit", Number.MAX_SAFE_INTEGER] }] },
  };
  switch (phase) {
    case "inactive":
      return { status: "inactive" };
    case "expired":
      return { ...active, validUntil: { $lt: now } };
    case "used_up":
      return { ...active, validUntil: { $gte: now }, ...usedUp };
    case "scheduled":
      return { ...active, validUntil: { $gte: now }, validFrom: { $gt: now }, ...notUsedUp };
    case "live":
      return {
        ...active,
        validUntil: { $gte: now },
        $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }],
        ...notUsedUp,
      };
  }
}

export async function listCouponScopeOptions(vendorId: string): Promise<CouponScopeOptions> {
  const vendor = vendorObjectId(vendorId);
  await connect();
  const [venues, links, events] = await Promise.all([
    Venue.find({ vendorId: vendor }, { name: 1 }).sort({ name: 1 }).lean(),
    VendorMovie.find({ vendorId: vendor }, { movieId: 1 }).lean(),
    Event.find({ vendorId: vendor }, { title: 1, kind: 1 }).sort({ title: 1 }).lean(),
  ]);
  const movies = await Movie.find({ _id: { $in: links.map((l) => l.movieId) } }, { title: 1 })
    .sort({ title: 1 })
    .lean();
  return {
    venues: venues.map((v) => ({ value: v._id.toString(), label: v.name })),
    movies: movies.map((m) => ({ value: m._id.toString(), label: m.title })),
    events: events.map((e) => ({ value: e._id.toString(), label: e.title })),
  };
}

function scopeLabel(doc: LeanDoc<CouponAttrs>, options: CouponScopeOptions): string {
  const names = (ids: Types.ObjectId[] | undefined, list: { value: string; label: string }[]) =>
    (ids ?? []).map((id) => list.find((o) => o.value === id.toString())?.label ?? "Removed");
  const parts = [
    ...names(doc.venueIds, options.venues),
    ...names(doc.movieIds, options.movies),
    ...names(doc.eventIds, options.events),
  ];
  return parts.length === 0 ? "All my shows" : parts.join(", ");
}

function toRow(doc: LeanDoc<CouponAttrs>, options: CouponScopeOptions, now: Date): VendorCouponRow {
  return {
    id: doc._id.toString(),
    code: doc.code,
    title: doc.title,
    description: doc.description,
    kind: doc.kind,
    ...(doc.percentBps !== undefined ? { percentBps: doc.percentBps } : {}),
    ...(doc.flatPaise !== undefined ? { flatPaise: doc.flatPaise } : {}),
    ...(doc.maxDiscountPaise !== undefined ? { maxDiscountPaise: doc.maxDiscountPaise } : {}),
    minOrderPaise: doc.minOrderPaise ?? 0,
    appliesTo: doc.appliesTo,
    ...(doc.validFrom ? { validFrom: doc.validFrom.toISOString() } : {}),
    validUntil: doc.validUntil.toISOString(),
    ...(doc.usageLimit !== undefined ? { usageLimit: doc.usageLimit } : {}),
    ...(doc.perCustomerLimit !== undefined ? { perCustomerLimit: doc.perCustomerLimit } : {}),
    usedCount: doc.usedCount ?? 0,
    venueIds: (doc.venueIds ?? []).map(String),
    movieIds: (doc.movieIds ?? []).map(String),
    eventIds: (doc.eventIds ?? []).map(String),
    scopeLabel: scopeLabel(doc, options),
    showOnOffersPage: doc.showOnOffersPage === true,
    gradient: doc.gradient,
    terms: [...doc.terms],
    status: doc.status === "inactive" ? "inactive" : "active",
    phase: phaseOf(doc, now),
  };
}

export async function listVendorCoupons(
  vendorId: string,
  query: CouponListQuery,
  now: Date,
): Promise<{ rows: VendorCouponRow[]; total: number }> {
  const filter: Record<string, unknown> = { vendorId: vendorObjectId(vendorId) };
  if (query.phase) Object.assign(filter, phaseFilter(query.phase, now));
  const q = query.q.trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$and = [{ $or: [{ code: pattern }, { title: pattern }] }];
  }
  const field = (COUPON_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "createdAt";
  await connect();
  const [docs, total, options] = await Promise.all([
    Coupon.find(filter)
      .sort({ [field]: query.sort.direction === "asc" ? 1 : -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Coupon.countDocuments(filter),
    listCouponScopeOptions(vendorId),
  ]);
  return { rows: docs.map((d) => toRow(d, options, now)), total };
}

export async function getVendorCoupon(vendorId: string, couponId: string, now: Date): Promise<VendorCouponRow | null> {
  const _id = toObjectId(couponId);
  if (!_id) return null;
  await connect();
  const doc = await Coupon.findOne({ _id, vendorId: vendorObjectId(vendorId) }).lean();
  return doc ? toRow(doc, await listCouponScopeOptions(vendorId), now) : null;
}

const scopeError = (field: string) =>
  new AppError("VALIDATION_FAILED", "Choose from your own venues, films and listings only.", 422, {
    fieldErrors: { [field]: ["Choose from your own list only."] },
  });

/** The stored fields for the form values; scope lists are checked against the vendor's own records. */
async function toStored(vendorId: string, data: VendorCouponValues) {
  const options = await listCouponScopeOptions(vendorId);
  const check = (ids: string[], list: { value: string }[], field: string) => {
    const own = new Set(list.map((o) => o.value));
    if (ids.some((id) => !own.has(id))) throw scopeError(field);
    return [...new Set(ids)].map((id) => new Types.ObjectId(id));
  };
  const percent = data.kind === "percent";
  return {
    code: data.code,
    title: data.title,
    description: data.description,
    category: data.appliesTo === "food" ? "Food & Beverages" : "Tickets",
    icon: data.appliesTo === "food" ? ("popcorn" as const) : ("tags" as const),
    kind: data.kind,
    percentBps: percent && data.percentOff !== undefined ? Math.round(data.percentOff * 100) : undefined,
    flatPaise: percent ? undefined : data.flatPaise,
    // A flat discount is its own maximum.
    maxDiscountPaise: percent ? data.maxDiscountPaise : undefined,
    minOrderPaise: data.minOrderPaise,
    appliesTo: data.appliesTo,
    validFrom: new Date(data.validFrom),
    validUntil: new Date(data.validUntil),
    usageLimit: data.usageLimit,
    perCustomerLimit: data.perCustomerLimit,
    venueIds: check(data.venueIds, options.venues, "venueIds"),
    movieIds: check(data.movieIds, options.movies, "movieIds"),
    eventIds: check(data.eventIds, options.events, "eventIds"),
    showOnOffersPage: data.showOnOffersPage,
    gradient: data.gradient,
    terms: data.terms.length > 0 ? data.terms : defaultTerms(data),
    status: data.status,
  };
}

/** Terms shown in the public T&C dialog when the vendor wrote none. */
function defaultTerms(data: VendorCouponValues): string[] {
  const base = data.appliesTo === "food" ? "food order" : "ticket value";
  return [
    "Valid only on this partner's shows on ShowBuzz.",
    ...(data.minOrderPaise > 0 ? [`Minimum ${base} of ₹${(data.minOrderPaise / 100).toLocaleString("en-IN")}.`] : []),
    ...(data.kind === "percent" && data.maxDiscountPaise !== undefined
      ? [`Maximum discount ₹${(data.maxDiscountPaise / 100).toLocaleString("en-IN")}.`]
      : []),
    ...(data.perCustomerLimit !== undefined
      ? [`Can be used ${data.perCustomerLimit === 1 ? "once" : `${data.perCustomerLimit} times`} per customer.`]
      : []),
    "Cannot be combined with other coupons.",
  ];
}

const CODE_TAKEN = () =>
  new AppError("CONFLICT", "This code is already in use on ShowBuzz. Choose another.", 409, {
    fieldErrors: { code: ["This code is already in use. Choose another."] },
  });

export async function createVendorCoupon(vendorId: string, raw: unknown): Promise<{ id: string; code: string }> {
  const data = vendorCouponInputSchema.parse(raw);
  const vendor = vendorObjectId(vendorId);
  await connect();
  const stored = await toStored(vendorId, data);
  const last = await Coupon.findOne({ vendorId: vendor }, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  try {
    const doc = await Coupon.create({
      ...stored,
      vendorId: vendor,
      usedCount: 0,
      sortOrder: (last?.sortOrder ?? 1000) + 1,
    });
    return { id: doc._id.toString(), code: doc.code };
  } catch (err) {
    if (isDuplicateKey(err)) throw CODE_TAKEN();
    throw err;
  }
}

export async function updateVendorCoupon(
  vendorId: string,
  couponId: string,
  raw: unknown,
): Promise<{ id: string; code: string; changedFields: string[] }> {
  const data = vendorCouponInputSchema.parse(raw);
  const _id = toObjectId(couponId);
  if (!_id) throw NOT_FOUND();
  const vendor = vendorObjectId(vendorId);
  await connect();
  const before = await Coupon.findOne({ _id, vendorId: vendor }).lean();
  if (!before) throw NOT_FOUND();
  if (before.code !== data.code && (before.usedCount ?? 0) > 0) {
    throw new AppError("VALIDATION_FAILED", "The code can't change once it has been used.", 422, {
      fieldErrors: { code: ["The code can't change once it has been used."] },
    });
  }
  const stored = await toStored(vendorId, data);
  const unset = Object.fromEntries(
    Object.entries(stored)
      .filter(([, v]) => v === undefined)
      .map(([k]) => [k, 1]),
  );
  const set = Object.fromEntries(Object.entries(stored).filter(([, v]) => v !== undefined));
  try {
    await Coupon.updateOne(
      { _id, vendorId: vendor },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    );
  } catch (err) {
    if (isDuplicateKey(err)) throw CODE_TAKEN();
    throw err;
  }
  const ids = (list: Types.ObjectId[] | undefined) => (list ?? []).map(String);
  const changedFields = changedKeys(
    {
      code: before.code,
      title: before.title,
      description: before.description,
      kind: before.kind,
      percentBps: before.percentBps,
      flatPaise: before.flatPaise,
      maxDiscountPaise: before.maxDiscountPaise,
      minOrderPaise: before.minOrderPaise,
      appliesTo: before.appliesTo,
      validFrom: before.validFrom?.toISOString(),
      validUntil: before.validUntil.toISOString(),
      usageLimit: before.usageLimit,
      perCustomerLimit: before.perCustomerLimit,
      venueIds: ids(before.venueIds),
      movieIds: ids(before.movieIds),
      eventIds: ids(before.eventIds),
      showOnOffersPage: before.showOnOffersPage === true,
      gradient: before.gradient,
      terms: before.terms,
      status: before.status ?? "active",
    },
    {
      ...stored,
      validFrom: stored.validFrom.toISOString(),
      validUntil: stored.validUntil.toISOString(),
      venueIds: stored.venueIds.map(String),
      movieIds: stored.movieIds.map(String),
      eventIds: stored.eventIds.map(String),
    },
  ).filter((k) => !["category", "icon"].includes(k));
  return { id: couponId, code: data.code, changedFields };
}

export async function setVendorCouponStatus(
  vendorId: string,
  couponId: string,
  status: "active" | "inactive",
): Promise<{ code: string }> {
  const _id = toObjectId(couponId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const doc = await Coupon.findOneAndUpdate(
    { _id, vendorId: vendorObjectId(vendorId) },
    { $set: { status } },
    { projection: { code: 1 } },
  ).lean();
  if (!doc) throw NOT_FOUND();
  return { code: doc.code };
}
