"use server";

import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  createBanner,
  deleteBanner,
  moveBanner,
  setBannerActive,
  updateBanner,
} from "@showbuzz/core/services/admin/banner-admin.service";
import {
  createSeoEntry,
  deleteSeoEntry,
  saveSeoGlobal,
  saveSitePage,
  updateSeoEntry,
} from "@showbuzz/core/services/admin/content-admin.service";
import {
  createPlatformCoupon,
  setPlatformCouponStatus,
  updatePlatformCoupon,
} from "@showbuzz/core/services/admin/coupon-admin.service";
import { cancelGiftCard, issueComplimentaryGiftCard } from "@showbuzz/core/services/admin/gift-card-admin.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { SITE_PAGE_META, sitePageSlugSchema } from "@showbuzz/schemas/site-content";
import { formatINR } from "@showbuzz/utils/money";
import { actorOf } from "@/lib/actor";

/** Home banners, platform coupons, gift cards, website pages and SEO. */

const activeSchema = z.boolean();
const couponStatusSchema = z.enum(["active", "inactive"]);

// Banners

export async function createBannerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("banners:write");
    const banner = await createBanner(input);
    await logActivity(actorOf(current), {
      action: "banner_create",
      resource: "banner",
      resourceId: banner.id,
      summary: `Added home banner "${banner.title}"`,
      changedFields: ["title", "imageUrl", "linkUrl", "cityId", "startsAt", "endsAt", "active"],
    });
    revalidateWeb([CATALOG_TAGS.banners]);
    return { id: banner.id };
  });
}

export async function updateBannerAction(bannerId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("banners:write");
    const id = objectIdSchema.parse(bannerId);
    const { title, changedFields } = await updateBanner(id, input);
    await logActivity(actorOf(current), {
      action: "banner_update",
      resource: "banner",
      resourceId: id,
      summary: `Updated home banner "${title}"`,
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.banners]);
    return { saved: true as const };
  });
}

export async function setBannerActiveAction(bannerId: unknown, active: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("banners:write");
    const id = objectIdSchema.parse(bannerId);
    const on = activeSchema.parse(active);
    const { title } = await setBannerActive(id, on);
    await logActivity(actorOf(current), {
      action: on ? "banner_activate" : "banner_deactivate",
      resource: "banner",
      resourceId: id,
      summary: `${on ? "Switched on" : "Switched off"} home banner "${title}"`,
      changedFields: ["active"],
    });
    revalidateWeb([CATALOG_TAGS.banners]);
    return { saved: true as const };
  });
}

export async function deleteBannerAction(bannerId: unknown): Promise<ActionResult<{ deleted: true }>> {
  return runAction(async () => {
    const current = await requirePermission("banners:write");
    const id = objectIdSchema.parse(bannerId);
    const { title } = await deleteBanner(id);
    await logActivity(actorOf(current), {
      action: "banner_delete",
      resource: "banner",
      resourceId: id,
      summary: `Deleted home banner "${title}"`,
      changedFields: [],
    });
    revalidateWeb([CATALOG_TAGS.banners]);
    return { deleted: true as const };
  });
}

export async function moveBannerAction(input: unknown): Promise<ActionResult<{ moved: boolean }>> {
  return runAction(async () => {
    const current = await requirePermission("banners:write");
    const result = await moveBanner(input);
    if (result.moved) {
      await logActivity(actorOf(current), {
        action: "banner_reorder",
        resource: "banner",
        summary: "Changed the order of home banners",
        changedFields: ["sortOrder"],
      });
      revalidateWeb([CATALOG_TAGS.banners]);
    }
    return result;
  });
}

// Platform coupons

export async function createCouponAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("coupons:write");
    const coupon = await createPlatformCoupon(input);
    await logActivity(actorOf(current), {
      action: "coupon_create",
      resource: "coupon",
      resourceId: coupon.id,
      summary: `Created platform coupon ${coupon.code}`,
      changedFields: ["code", "kind", "minOrderPaise", "validUntil", "usageLimit", "status"],
    });
    revalidateWeb([CATALOG_TAGS.coupons]);
    return { id: coupon.id };
  });
}

export async function updateCouponAction(couponId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("coupons:write");
    const id = objectIdSchema.parse(couponId);
    const { code, changedFields } = await updatePlatformCoupon(id, input);
    await logActivity(actorOf(current), {
      action: "coupon_update",
      resource: "coupon",
      resourceId: id,
      summary: `Updated platform coupon ${code}`,
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.coupons]);
    return { saved: true as const };
  });
}

export async function setCouponStatusAction(couponId: unknown, status: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("coupons:write");
    const id = objectIdSchema.parse(couponId);
    const next = couponStatusSchema.parse(status);
    const { code } = await setPlatformCouponStatus(id, next);
    await logActivity(actorOf(current), {
      action: next === "active" ? "coupon_activate" : "coupon_deactivate",
      resource: "coupon",
      resourceId: id,
      summary: `${next === "active" ? "Switched on" : "Switched off"} coupon ${code}`,
      changedFields: ["status"],
    });
    revalidateWeb([CATALOG_TAGS.coupons]);
    return { saved: true as const };
  });
}

// Gift cards

export async function issueGiftCardAction(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("gift-cards:issue");
    const card = await issueComplimentaryGiftCard(current.staff.id, input, new Date());
    await logActivity(actorOf(current), {
      action: "gift_card_issue",
      resource: "gift_card",
      resourceId: card.id,
      summary: `Issued a complimentary gift card of ${formatINR(card.amountPaise)}`,
      changedFields: ["amountPaise", "recipientName", "recipientContact", "issueReason"],
    });
    return { id: card.id, code: card.code };
  });
}

export async function cancelGiftCardAction(
  cardId: unknown,
  input: unknown,
): Promise<ActionResult<{ refundedPaise: number }>> {
  return runAction(async () => {
    const current = await requirePermission("gift-cards:write");
    const id = objectIdSchema.parse(cardId);
    const result = await cancelGiftCard(current.staff.id, id, input, new Date());
    await logActivity(actorOf(current), {
      action: "gift_card_cancel",
      resource: "gift_card",
      resourceId: id,
      summary:
        result.refundedPaise > 0
          ? `Cancelled gift card ending ${result.code.slice(-4)} and refunded the buyer ${formatINR(result.refundedPaise)}`
          : `Cancelled gift card ending ${result.code.slice(-4)} (${formatINR(result.zeroedPaise)} balance voided)`,
      changedFields: ["status", "balancePaise", "cancelReason"],
    });
    return { refundedPaise: result.refundedPaise };
  });
}

// Website pages and SEO

export async function saveSitePageAction(slug: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("pages:write");
    const page = sitePageSlugSchema.parse(slug);
    const { changedFields } = await saveSitePage(page, input, current.staff.id);
    await logActivity(actorOf(current), {
      action: "page_update",
      resource: "page",
      resourceId: page,
      summary: `Edited the ${SITE_PAGE_META[page].name} page`,
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.pages]);
    return { saved: true as const };
  });
}

export async function saveSeoGlobalAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("seo:write");
    const { changedFields } = await saveSeoGlobal(input);
    await logActivity(actorOf(current), {
      action: "seo_global_update",
      resource: "seo",
      resourceId: "global",
      summary: "Updated the site-wide SEO defaults",
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.seo]);
    return { saved: true as const };
  });
}

export async function createSeoEntryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("seo:write");
    const entry = await createSeoEntry(input);
    await logActivity(actorOf(current), {
      action: "seo_create",
      resource: "seo",
      resourceId: entry.id,
      summary: `Added SEO settings for ${entry.path}`,
      changedFields: ["path", "title", "description", "ogImage", "noindex"],
    });
    revalidateWeb([CATALOG_TAGS.seo]);
    return { id: entry.id };
  });
}

export async function updateSeoEntryAction(entryId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("seo:write");
    const id = objectIdSchema.parse(entryId);
    const { path, changedFields } = await updateSeoEntry(id, input);
    await logActivity(actorOf(current), {
      action: "seo_update",
      resource: "seo",
      resourceId: id,
      summary: `Updated SEO settings for ${path}`,
      changedFields,
    });
    revalidateWeb([CATALOG_TAGS.seo]);
    return { saved: true as const };
  });
}

export async function deleteSeoEntryAction(entryId: unknown): Promise<ActionResult<{ deleted: true }>> {
  return runAction(async () => {
    const current = await requirePermission("seo:write");
    const id = objectIdSchema.parse(entryId);
    const { path } = await deleteSeoEntry(id);
    await logActivity(actorOf(current), {
      action: "seo_delete",
      resource: "seo",
      resourceId: id,
      summary: `Removed SEO settings for ${path}`,
      changedFields: [],
    });
    revalidateWeb([CATALOG_TAGS.seo]);
    return { deleted: true as const };
  });
}
