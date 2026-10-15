import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Banner, type BannerAttrs } from "@showbuzz/db/models/Banner";
import { ACTIVE_CITY_FILTER, City } from "@showbuzz/db/models/City";
import type { Types } from "@showbuzz/db/mongoose";
import { type BannerInput, bannerInputSchema } from "@showbuzz/schemas/banner";
import type { BannerRow } from "@showbuzz/schemas/types/admin-platform";
import { AppError } from "../../http/app-error";
import { moveInOrder } from "./master-data-admin.service";
import { changedKeys, cityNames, idOr404 } from "./shared";

/** Home banners (prompt 7): the public home hero carousel, ordered with up/down. Nothing references them. */

type LeanBanner = BannerAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "Banner not found.", 404);

function isLive(doc: LeanBanner, now: Date): boolean {
  return doc.active && (!doc.startsAt || doc.startsAt <= now) && (!doc.endsAt || doc.endsAt > now);
}

export async function listBannersAdmin(now: Date): Promise<BannerRow[]> {
  await connect();
  const [docs, cities] = await Promise.all([
    Banner.find({ placement: "home_hero" }).sort({ sortOrder: 1, _id: 1 }).lean(),
    cityNames(),
  ]);
  return docs.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    blurb: d.blurb,
    badge: d.badge,
    imageUrl: d.imageUrl,
    ctaLabel: d.ctaLabel,
    linkUrl: d.linkUrl,
    cityName: d.cityId ? (cities.get(d.cityId) ?? d.cityId) : "All cities",
    ...(d.startsAt ? { startsAt: d.startsAt.toISOString() } : {}),
    ...(d.endsAt ? { endsAt: d.endsAt.toISOString() } : {}),
    active: d.active,
    live: isLive(d, now),
  }));
}

function toValues(doc: LeanBanner): BannerInput {
  return {
    title: doc.title,
    blurb: doc.blurb,
    badge: doc.badge,
    icon: doc.icon,
    tone: doc.tone,
    imageUrl: doc.imageUrl,
    ctaLabel: doc.ctaLabel,
    linkUrl: doc.linkUrl,
    placement: doc.placement,
    cityId: doc.cityId ?? "",
    startsAt: doc.startsAt?.toISOString() ?? "",
    endsAt: doc.endsAt?.toISOString() ?? "",
    active: doc.active,
  };
}

export async function getBannerValues(bannerId: string): Promise<BannerInput | null> {
  const _id = idOr404(bannerId, "Banner");
  await connect();
  const doc = await Banner.findById(_id).lean();
  return doc ? toValues(doc) : null;
}

async function fields(input: unknown) {
  const data = bannerInputSchema.parse(input);
  if (data.cityId && !(await City.exists({ slug: data.cityId, ...ACTIVE_CITY_FILTER }))) {
    throw new AppError("VALIDATION_FAILED", "Choose an active city.", 422, {
      fieldErrors: { cityId: ["Choose an active city."] },
    });
  }
  const set = {
    title: data.title,
    blurb: data.blurb,
    badge: data.badge,
    icon: data.icon,
    tone: data.tone,
    imageUrl: data.imageUrl,
    ctaLabel: data.ctaLabel,
    linkUrl: data.linkUrl,
    placement: data.placement,
    active: data.active,
    ...(data.cityId ? { cityId: data.cityId } : {}),
    ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
    ...(data.endsAt ? { endsAt: new Date(data.endsAt) } : {}),
  };
  const unset = {
    ...(data.cityId ? {} : { cityId: 1 }),
    ...(data.startsAt ? {} : { startsAt: 1 }),
    ...(data.endsAt ? {} : { endsAt: 1 }),
  };
  return { data, set, unset };
}

export async function createBanner(input: unknown): Promise<{ id: string; title: string }> {
  await connect();
  const { set } = await fields(input);
  const last = await Banner.findOne({ placement: set.placement }, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  const doc = await Banner.create({ ...set, sortOrder: (last?.sortOrder ?? 0) + 1 });
  return { id: doc._id.toString(), title: doc.title };
}

export async function updateBanner(bannerId: string, input: unknown): Promise<{ title: string; changedFields: string[] }> {
  const _id = idOr404(bannerId, "Banner");
  await connect();
  const before = await Banner.findById(_id).lean();
  if (!before) throw NOT_FOUND();
  const { data, set, unset } = await fields(input);
  await Banner.updateOne({ _id }, { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) });
  return { title: data.title, changedFields: changedKeys({ ...toValues(before) }, { ...data }) };
}

export async function setBannerActive(bannerId: string, active: boolean): Promise<{ title: string }> {
  const _id = idOr404(bannerId, "Banner");
  await connect();
  const doc = await Banner.findOneAndUpdate({ _id }, { $set: { active } }, { lean: true, projection: { title: 1 } });
  if (!doc) throw NOT_FOUND();
  return { title: doc.title };
}

export async function deleteBanner(bannerId: string): Promise<{ title: string }> {
  const _id = idOr404(bannerId, "Banner");
  await connect();
  const doc = await Banner.findOneAndDelete({ _id }, { projection: { title: 1 } }).lean();
  if (!doc) throw NOT_FOUND();
  return { title: doc.title };
}

export const moveBanner = (input: unknown) => moveInOrder(Banner, { placement: "home_hero" }, input);
