import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { PublicBanner } from "@showbuzz/schemas/banner";
import { sortOrderField } from "./transforms";

/**
 * A home banner (prompt 7). Nothing references banners, so they can be deleted. `cityId` absent = every city;
 * `startsAt`/`endsAt` are checked by the public carousel in the browser (the home page stays cached).
 */
export interface BannerAttrs {
  title: string;
  blurb: string;
  badge: string;
  icon: PublicBanner["icon"];
  tone: PublicBanner["tone"];
  imageUrl: string;
  ctaLabel: string;
  linkUrl: string;
  placement: "home_hero";
  cityId?: string;
  startsAt?: Date;
  endsAt?: Date;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<BannerAttrs>(
  {
    title: { type: String, required: true, trim: true },
    blurb: { type: String, default: "" },
    badge: { type: String, default: "" },
    icon: { type: String, enum: ["zap", "music", "trophy"], default: "zap" },
    tone: { type: String, enum: ["rose", "purple", "emerald"], default: "rose" },
    imageUrl: { type: String, required: true },
    ctaLabel: { type: String, required: true },
    linkUrl: { type: String, required: true },
    placement: { type: String, enum: ["home_hero"], required: true, default: "home_hero" },
    cityId: String,
    startsAt: Date,
    endsAt: Date,
    active: { type: Boolean, default: true },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

bannerSchema.index({ placement: 1, sortOrder: 1 });

export function toPublicBanner(doc: BannerAttrs & { _id: Types.ObjectId }): PublicBanner {
  return {
    id: doc._id.toString(),
    title: doc.title,
    blurb: doc.blurb,
    badge: doc.badge,
    icon: doc.icon,
    tone: doc.tone,
    imageUrl: doc.imageUrl,
    ctaLabel: doc.ctaLabel,
    linkUrl: doc.linkUrl,
    ...(doc.cityId ? { cityId: doc.cityId } : {}),
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    ...(doc.endsAt ? { endsAt: doc.endsAt.toISOString() } : {}),
  };
}

export const Banner: Model<BannerAttrs> =
  (models.Banner as Model<BannerAttrs> | undefined) ?? model<BannerAttrs>("Banner", bannerSchema, "banners");
