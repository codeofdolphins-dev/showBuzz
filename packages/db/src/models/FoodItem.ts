import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { FoodItem as FoodItemShape } from "@showbuzz/schemas/food";
import { type LeanDoc, sortOrderField } from "./transforms";

/** A snack or combo for cinema pre-orders. `code` is the stable seed key ("fb-1"). */
export interface FoodItemAttrs extends Omit<FoodItemShape, "id"> {
  code: string;
  sortOrder: number;
}

const foodItemSchema = new Schema<FoodItemAttrs>(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["Popcorn", "Snacks", "Combo Meals", "Beverages"], required: true },
    isVeg: { type: Boolean, default: true },
    pricePaise: { type: Number, required: true, min: 0 },
    size: { type: String, default: "" },
    image: { type: String, required: true },
    description: { type: String, default: "" },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

foodItemSchema.index({ code: 1 }, { unique: true });

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
