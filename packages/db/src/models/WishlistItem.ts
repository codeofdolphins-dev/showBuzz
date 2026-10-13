import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/** One saved movie or event in a customer's wishlist. Unique per customer and item, so saving twice is a no-op. */
export interface WishlistItemAttrs {
  userId: Types.ObjectId;
  kind: "movie" | "event";
  /** movies._id or events._id */
  itemId: Types.ObjectId;
  createdAt: Date;
}

const wishlistItemSchema = new Schema<WishlistItemAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["movie", "event"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

wishlistItemSchema.index({ userId: 1, kind: 1, itemId: 1 }, { unique: true });
wishlistItemSchema.index({ userId: 1, createdAt: -1 });

export const WishlistItem: Model<WishlistItemAttrs> =
  (models.WishlistItem as Model<WishlistItemAttrs> | undefined) ??
  model<WishlistItemAttrs>("WishlistItem", wishlistItemSchema, "wishlists");
