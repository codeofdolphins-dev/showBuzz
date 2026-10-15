import "server-only";
import { type Model, Schema, model, models } from "mongoose";

/**
 * SEO overrides (prompt 7). `key` is "global" for the site-wide default title/description, or a path on
 * showbuzz.com ("/movies", "/movies/<slug>") whose metadata it overrides. Empty fields keep the page's own.
 */
export interface SeoMetaAttrs {
  key: string;
  title: string;
  description: string;
  ogImage: string;
  noindex: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SEO_GLOBAL_KEY = "global";

const seoMetaSchema = new Schema<SeoMetaAttrs>(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    ogImage: { type: String, default: "" },
    noindex: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

seoMetaSchema.index({ key: 1 }, { unique: true });

export const SeoMeta: Model<SeoMetaAttrs> =
  (models.SeoMeta as Model<SeoMetaAttrs> | undefined) ?? model<SeoMetaAttrs>("SeoMeta", seoMetaSchema, "seoMeta");
