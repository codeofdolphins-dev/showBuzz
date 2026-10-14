import "server-only";
import { randomBytes } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { FoodItem, type FoodItemAttrs } from "@showbuzz/db/models/FoodItem";
import { Venue } from "@showbuzz/db/models/Venue";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { Types } from "@showbuzz/db/mongoose";
import type { FoodCategory } from "@showbuzz/schemas/food";
import { foodItemInputSchema } from "@showbuzz/schemas/partner-box-office";
import type { VendorFoodRow } from "@showbuzz/schemas/types/partner-box-office";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { changedKeys, toObjectId } from "./ids";

/**
 * The vendor's food & beverage menu (offered with movie shows at its cinemas, on the public food step). Every query
 * is filtered by the session's vendor id; another vendor's item answers 404. Items are switched off
 * (`available: false`) rather than deleted: bookings keep their own snapshot of what was ordered.
 */

export const FOOD_SORT_FIELDS = ["name", "pricePaise"] as const;

export interface FoodListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  category?: FoodCategory;
  available?: boolean;
  venueId?: string;
}

const NOT_FOUND = () => new AppError("NOT_FOUND", "This menu item doesn't exist or isn't yours.", 404);

function vendorObjectId(vendorId: string): Types.ObjectId {
  const id = toObjectId(vendorId);
  if (!id) throw NOT_FOUND();
  return id;
}

/** The vendor's cinemas, for the "which venues" picker. */
export async function listVendorCinemaOptions(vendorId: string): Promise<{ value: string; label: string }[]> {
  await connect();
  const venues = await Venue.find({ vendorId: vendorObjectId(vendorId), kind: "cinema" }, { name: 1 })
    .sort({ name: 1 })
    .lean();
  return venues.map((v) => ({ value: v._id.toString(), label: v.name }));
}

function toRow(doc: LeanDoc<FoodItemAttrs>, venueNames: Map<string, string>): VendorFoodRow {
  const venueIds = (doc.venueIds ?? []).map(String);
  return {
    id: doc._id.toString(),
    name: doc.name,
    category: doc.category,
    isVeg: doc.isVeg,
    pricePaise: doc.pricePaise,
    size: doc.size,
    image: doc.image,
    description: doc.description,
    venueIds,
    venuesLabel:
      venueIds.length === 0 ? "All my cinemas" : venueIds.map((id) => venueNames.get(id) ?? "Removed venue").join(", "),
    available: doc.available !== false,
  };
}

async function venueNameMap(vendorId: string): Promise<Map<string, string>> {
  return new Map((await listVendorCinemaOptions(vendorId)).map((v) => [v.value, v.label]));
}

export async function listVendorFood(
  vendorId: string,
  query: FoodListQuery,
): Promise<{ rows: VendorFoodRow[]; total: number }> {
  const filter: Record<string, unknown> = { vendorId: vendorObjectId(vendorId) };
  if (query.category) filter.category = query.category;
  if (query.available === true) filter.available = { $ne: false };
  if (query.available === false) filter.available = false;
  const venueId = query.venueId ? toObjectId(query.venueId) : null;
  if (venueId) filter.$or = [{ venueIds: { $size: 0 } }, { venueIds: venueId }];
  if (query.q.trim()) filter.name = new RegExp(escapeRegex(query.q.trim()), "i");
  const field = (FOOD_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "sortOrder";
  await connect();
  const [docs, total, names] = await Promise.all([
    FoodItem.find(filter)
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    FoodItem.countDocuments(filter),
    venueNameMap(vendorId),
  ]);
  return { rows: docs.map((d) => toRow(d, names)), total };
}

export async function getVendorFoodItem(vendorId: string, itemId: string): Promise<VendorFoodRow | null> {
  const _id = toObjectId(itemId);
  if (!_id) return null;
  await connect();
  const doc = await FoodItem.findOne({ _id, vendorId: vendorObjectId(vendorId) }).lean();
  return doc ? toRow(doc, await venueNameMap(vendorId)) : null;
}

/** Only the vendor's own cinemas can be picked. */
async function checkVenues(vendorId: string, venueIds: string[]): Promise<Types.ObjectId[]> {
  if (venueIds.length === 0) return [];
  const own = new Set((await listVendorCinemaOptions(vendorId)).map((v) => v.value));
  const unknown = venueIds.filter((id) => !own.has(id));
  if (unknown.length > 0) {
    throw new AppError("VALIDATION_FAILED", "Choose your own cinemas only.", 422, {
      fieldErrors: { venueIds: ["Choose your own cinemas only."] },
    });
  }
  return [...new Set(venueIds)].map((id) => new Types.ObjectId(id));
}

export async function createFoodItem(vendorId: string, raw: unknown): Promise<{ id: string; name: string }> {
  const data = foodItemInputSchema.parse(raw);
  const vendor = vendorObjectId(vendorId);
  await connect();
  const venueIds = await checkVenues(vendorId, data.venueIds);
  const last = await FoodItem.findOne({ vendorId: vendor }, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  const doc = await FoodItem.create({
    vendorId: vendor,
    code: `item-${randomBytes(6).toString("hex")}`,
    ...data,
    venueIds,
    sortOrder: (last?.sortOrder ?? 0) + 1,
  });
  return { id: doc._id.toString(), name: data.name };
}

export async function updateFoodItem(
  vendorId: string,
  itemId: string,
  raw: unknown,
): Promise<{ id: string; name: string; changedFields: string[] }> {
  const data = foodItemInputSchema.parse(raw);
  const _id = toObjectId(itemId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const vendor = vendorObjectId(vendorId);
  const before = await FoodItem.findOne({ _id, vendorId: vendor }).lean();
  if (!before) throw NOT_FOUND();
  const venueIds = await checkVenues(vendorId, data.venueIds);
  await FoodItem.updateOne({ _id, vendorId: vendor }, { $set: { ...data, venueIds } });
  const changedFields = changedKeys(
    {
      name: before.name,
      category: before.category,
      isVeg: before.isVeg,
      pricePaise: before.pricePaise,
      size: before.size,
      image: before.image,
      description: before.description,
      venueIds: (before.venueIds ?? []).map(String),
      available: before.available !== false,
    },
    { ...data, venueIds: venueIds.map(String) },
  );
  return { id: itemId, name: data.name, changedFields };
}

/** Switches an item on or off the public menu. */
export async function setFoodAvailability(
  vendorId: string,
  itemId: string,
  available: boolean,
): Promise<{ name: string }> {
  const _id = toObjectId(itemId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const doc = await FoodItem.findOneAndUpdate(
    { _id, vendorId: vendorObjectId(vendorId) },
    { $set: { available } },
    { projection: { name: 1 } },
  ).lean();
  if (!doc) throw NOT_FOUND();
  return { name: doc.name };
}
