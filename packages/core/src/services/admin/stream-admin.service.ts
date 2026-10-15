import "server-only";
import { connect } from "@showbuzz/db/connect";
import { StreamTitle, type StreamTitleAttrs } from "@showbuzz/db/models/StreamTitle";
import { Types } from "@showbuzz/db/mongoose";
import { streamTitleInputSchema, type StreamTitleInput } from "@showbuzz/schemas/admin-catalog";
import type { AdminStreamRow } from "@showbuzz/schemas/types/admin-catalog";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { changedFieldNames } from "../activity-log.service";
import { moveInOrder } from "./master-data-admin.service";

/**
 * Online stream titles (the rent/buy shelf on /stream). Platform-owned: staff with `streaming:write` create and edit
 * them; inactive titles are hidden publicly (never deleted, so the history of what was listed stays). Checkout for
 * streams is not built yet: the public buttons say "coming soon".
 */

type LeanStream = StreamTitleAttrs & { _id: Types.ObjectId };

export const STREAM_SORT_FIELDS = ["sortOrder", "title", "rentPricePaise"] as const;

function toRow(doc: LeanStream): AdminStreamRow {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    category: doc.category,
    badge: doc.badge,
    poster: doc.poster,
    rentPricePaise: doc.rentPricePaise,
    buyPricePaise: doc.buyPricePaise,
    durationMinutes: doc.durationMinutes,
    rating: doc.rating,
    featured: doc.featured,
    status: doc.status ?? "active",
    sortOrder: doc.sortOrder,
  };
}

const toInput = (row: AdminStreamRow): StreamTitleInput => ({
  title: row.title,
  slug: row.slug,
  category: row.category,
  badge: row.badge,
  rentPricePaise: row.rentPricePaise,
  buyPricePaise: row.buyPricePaise,
  durationMinutes: row.durationMinutes,
  rating: row.rating,
  poster: row.poster,
  description: "",
  featured: row.featured,
  status: row.status,
});

export async function listStreamsAdmin(query: {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  status?: "active" | "inactive";
}): Promise<{ rows: AdminStreamRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.status === "inactive") filter.status = "inactive";
  if (query.status === "active") filter.status = { $ne: "inactive" };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: pattern }, { category: pattern }, { slug: pattern }];
  }
  const field = (STREAM_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "sortOrder";
  const [docs, total] = await Promise.all([
    StreamTitle.find(filter)
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanStream[]>(),
    StreamTitle.countDocuments(filter),
  ]);
  return { total, rows: docs.map(toRow) };
}

export async function getStreamAdmin(id: string): Promise<{ id: string; values: StreamTitleInput } | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connect();
  const doc = await StreamTitle.findById(id).lean<LeanStream>();
  if (!doc) return null;
  return { id: doc._id.toString(), values: { ...toInput(toRow(doc)), description: doc.description } };
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another title already uses this slug.", 409, {
    fieldErrors: { slug: ["Another title already uses this slug."] },
  });

const isDuplicate = (err: unknown) => (err as { code?: number }).code === 11000;

export async function createStream(input: unknown): Promise<{ id: string; title: string }> {
  const values = streamTitleInputSchema.parse(input);
  await connect();
  const last = await StreamTitle.findOne({}, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  try {
    const doc = await StreamTitle.create({ ...values, sortOrder: (last?.sortOrder ?? 0) + 1 });
    return { id: doc._id.toString(), title: doc.title };
  } catch (err) {
    if (isDuplicate(err)) throw slugTaken();
    throw err;
  }
}

export async function updateStream(id: string, input: unknown): Promise<{ title: string; changedFields: string[] }> {
  const values = streamTitleInputSchema.parse(input);
  const current = await getStreamAdmin(id);
  if (!current) throw new AppError("NOT_FOUND", "Title not found.", 404);
  try {
    await StreamTitle.updateOne({ _id: new Types.ObjectId(id) }, { $set: values });
  } catch (err) {
    if (isDuplicate(err)) throw slugTaken();
    throw err;
  }
  return { title: values.title, changedFields: changedFieldNames(current.values, values) };
}

export async function moveStream(input: unknown): Promise<{ moved: boolean }> {
  return moveInOrder(StreamTitle, {}, input);
}
