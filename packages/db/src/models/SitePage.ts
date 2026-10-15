import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { PageStatus, SitePageSlug } from "@showbuzz/schemas/site-content";

/**
 * An editable website page (About, Privacy, Terms, FAQ): structured content validated by the page's Zod schema
 * (PAGE_CONTENT_SCHEMAS) on save and again on read; anything invalid falls back to DEFAULT_PAGES.
 */
export interface SitePageAttrs {
  slug: SitePageSlug;
  status: PageStatus;
  content: Record<string, unknown>;
  updatedByStaffId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sitePageSchema = new Schema<SitePageAttrs>(
  {
    slug: { type: String, enum: ["about", "privacy", "terms", "faq"], required: true },
    status: { type: String, enum: ["published", "draft"], default: "published", required: true },
    content: { type: Schema.Types.Mixed, required: true },
    updatedByStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

sitePageSchema.index({ slug: 1 }, { unique: true });

export const SitePage: Model<SitePageAttrs> =
  (models.SitePage as Model<SitePageAttrs> | undefined) ??
  model<SitePageAttrs>("SitePage", sitePageSchema, "pages");
