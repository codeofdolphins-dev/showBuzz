import "server-only";
import { City } from "@showbuzz/db/models/City";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { Model, Types } from "@showbuzz/db/mongoose";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { toObjectId } from "../partner/ids";

/** Helpers shared by the super-admin services (packages/core/src/services/admin/*). */

export { isDuplicateKey, changedKeys } from "../partner/ids";

export interface AdminListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
}

/** An id from the URL or a form as an ObjectId, or a 404 with `what` in the message. */
export function idOr404(id: string, what: string): Types.ObjectId {
  const objectId = toObjectId(id);
  if (!objectId) throw new AppError("NOT_FOUND", `${what} not found.`, 404);
  return objectId;
}

export const optionalId = (id: string | undefined) => (id ? toObjectId(id) : null);

export function sortSpec(query: AdminListQuery, allowed: readonly string[], fallback: string): Record<string, 1 | -1> {
  const field = allowed.includes(query.sort.field) ? query.sort.field : fallback;
  return { [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 };
}

export const searchPattern = (q: string) => new RegExp(escapeRegex(q.trim()), "i");

export async function vendorNames(ids: (Types.ObjectId | undefined | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const docs = await Vendor.find({ _id: { $in: unique } }, { businessName: 1 }).lean();
  return new Map(docs.map((d) => [d._id.toString(), d.businessName]));
}

export async function cityNames(): Promise<Map<string, string>> {
  const docs = await City.find({}, { slug: 1, name: 1 }).lean();
  return new Map(docs.map((c) => [c.slug, c.name]));
}

/** Vendors for filter dropdowns and pickers. */
export async function listVendorOptions(filter: Record<string, unknown> = {}) {
  const docs = await Vendor.find(filter, { businessName: 1 }).sort({ businessName: 1 }).lean();
  return docs.map((d) => ({ value: d._id.toString(), label: d.businessName }));
}

/**
 * The next "PREFIX-YYYY-MM-0001" code for a month. Not atomic on its own: callers insert with it and, on a
 * duplicate code (two staff at once), ask for the next one again (`withCodeRetry`).
 */
export async function nextMonthlyCode<T extends { code: string }>(
  model: Model<T>,
  prefix: string,
  month: string,
): Promise<string> {
  const base = `${prefix}-${month}-`;
  const last = await model
    .findOne({ code: new RegExp(`^${escapeRegex(base)}\\d+$`) }, { code: 1 })
    .sort({ code: -1 })
    .lean<{ code: string } | null>();
  const n = last ? Number(last.code.slice(base.length)) + 1 : 1;
  return `${base}${String(n).padStart(4, "0")}`;
}

/** Runs `fn` again (up to 5 times) when it failed on a duplicate code. */
export async function withCodeRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
      if (attempt < 5 && (err as { code?: number }).code === 11000 && keyPattern && "code" in keyPattern) continue;
      throw err;
    }
  }
}
