import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { FoodItem as FoodItemShape } from "@showbuzz/schemas/food";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * A snack or combo for cinema pre-orders, owned by a vendor. `venueIds` limits it to some of that vendor's
 * cinemas (empty = all of them). `code` is unique per vendor (the seed key, "fb-1"). `available: false` takes it
 * off the public menu without deleting it (orders keep their own snapshot of name and price).
 */
export interface FoodItemAttrs extends Omit<FoodItemShape, "id"> {
  vendorId: Types.ObjectId;
  venueIds: Types.ObjectId[];
  code: string;
  /** Missing = available. */
  available?: boolean;
  sortOrder: number;
}

const foodItemSchema = new Schema<FoodItemAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    venueIds: { type: [Schema.Types.ObjectId], ref: "Venue", default: [] },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["Popcorn", "Snacks", "Combo Meals", "Beverages"], required: true },
    isVeg: { type: Boolean, default: true },
    pricePaise: { type: Number, required: true, min: 0 },
    size: { type: String, default: "" },
    image: { type: String, required: true },
    description: { type: String, default: "" },
    available: { type: Boolean, default: true },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

foodItemSchema.index({ vendorId: 1, code: 1 }, { unique: true });

export function toFoodItem(doc: LeanDoc<FoodItemAttrs>): FoodItemShape {
  return {
    id: doc._id.toString(),
    name: doc.name,
    category: doc.category,
    isVeg: doc.isVeg,
    pricePaise: doc.pricePaise,
    size: doc.size,
    image: doc.image,
    description: doc.description,
  };
}

export const FoodItem: Model<FoodItemAttrs> =
  (models.FoodItem as Model<FoodItemAttrs> | undefined) ??
  model<FoodItemAttrs>("FoodItem", foodItemSchema, "foodItems");
