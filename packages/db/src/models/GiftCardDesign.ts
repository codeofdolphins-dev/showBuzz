import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { GiftCardDesign as GiftCardDesignShape } from "@showbuzz/schemas/gift-card";
import { type LeanDoc, sortOrderField } from "./transforms";

/** A gift card artwork option. `code` is the stable seed key ("gc-rose"). */
export interface GiftCardDesignAttrs extends Omit<GiftCardDesignShape, "id"> {
  code: string;
  sortOrder: number;
}

const giftCardDesignSchema = new Schema<GiftCardDesignAttrs>(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    gradient: { type: String, default: "" },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

giftCardDesignSchema.index({ code: 1 }, { unique: true });

export function toGiftCardDesign(doc: LeanDoc<GiftCardDesignAttrs>): GiftCardDesignShape {
  return { id: doc._id.toString(), name: doc.name, gradient: doc.gradient };
}

export const GiftCardDesign: Model<GiftCardDesignAttrs> =
  (models.GiftCardDesign as Model<GiftCardDesignAttrs> | undefined) ??
  model<GiftCardDesignAttrs>("GiftCardDesign", giftCardDesignSchema, "giftCardDesigns");
