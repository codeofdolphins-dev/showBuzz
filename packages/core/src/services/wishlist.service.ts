import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Event } from "@showbuzz/db/models/Event";
import { Movie } from "@showbuzz/db/models/Movie";
import { WishlistItem } from "@showbuzz/db/models/WishlistItem";
import { Types } from "@showbuzz/db/mongoose";
import { AppError } from "../http/app-error";

/**
 * Signed-in customers' wishlists (`wishlists`, one document per saved item, unique per customer + item).
 * Clients send bare movie/event ids (as the device-local wishlist always has); the kind is looked up here,
 * and ids that match nothing (e.g. pre-database seed ids) are dropped.
 */

export const MAX_WISHLIST_ITEMS = 200;

type Kind = "movie" | "event";

async function resolveKinds(ids: string[]): Promise<Map<string, Kind>> {
  const valid = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id) && /^[0-9a-f]{24}$/.test(id));
  if (valid.length === 0) return new Map();
  const [movies, events] = await Promise.all([
    Movie.find({ _id: { $in: valid } }, { _id: 1 }).lean(),
    Event.find({ _id: { $in: valid } }, { _id: 1 }).lean(),
  ]);
  const kinds = new Map<string, Kind>();
  movies.forEach((m) => kinds.set(m._id.toString(), "movie"));
  events.forEach((e) => kinds.set(e._id.toString(), "event"));
  return kinds;
}

/** The customer's saved item ids, newest first. */
export async function listWishlistIds(userId: string): Promise<string[]> {
  await connect();
  const items = await WishlistItem.find({ userId }, { itemId: 1 })
    .sort({ createdAt: -1 })
    .limit(MAX_WISHLIST_ITEMS)
    .lean();
  return items.map((i) => i.itemId.toString());
}

/** Saves or removes one item. Idempotent: saving twice or removing a missing item changes nothing. */
export async function setWishlistItem(userId: string, itemId: string, saved: boolean): Promise<void> {
  await connect();
  if (!saved) {
    if (Types.ObjectId.isValid(itemId)) await WishlistItem.deleteOne({ userId, itemId });
    return;
  }
  const kind = (await resolveKinds([itemId])).get(itemId);
  if (!kind) throw new AppError("NOT_FOUND", "This title is no longer available.", 404);
  if ((await WishlistItem.countDocuments({ userId })) >= MAX_WISHLIST_ITEMS) {
    throw new AppError("VALIDATION_FAILED", `Your wishlist can hold up to ${MAX_WISHLIST_ITEMS} titles.`, 422);
  }
  await WishlistItem.updateOne({ userId, kind, itemId }, { $setOnInsert: { userId, kind, itemId } }, { upsert: true });
}

/** Adds a device's local wishlist to the account (run once at sign-in) and returns the merged list. */
export async function mergeWishlist(userId: string, ids: string[]): Promise<string[]> {
  await connect();
  const kinds = await resolveKinds(ids.slice(0, MAX_WISHLIST_ITEMS));
  if (kinds.size > 0) {
    await WishlistItem.bulkWrite(
      [...kinds].map(([itemId, kind]) => ({
        updateOne: {
          filter: { userId: new Types.ObjectId(userId), kind, itemId: new Types.ObjectId(itemId) },
          update: { $setOnInsert: { createdAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return listWishlistIds(userId);
}
