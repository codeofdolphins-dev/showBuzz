import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorCoupon, listCouponScopeOptions } from "@showbuzz/core/services/partner/coupon.service";
import { CouponForm } from "@/components/offers/CouponForm";

export const metadata: Metadata = { title: "Edit coupon" };

export default async function EditCouponPage({ params }: PageProps<"/offers/[couponId]/edit">) {
  const { couponId } = await params;
  const { vendor } = await requireVendorPage(`/offers/${couponId}/edit`);
  const now = new Date();
  const [coupon, scope] = await Promise.all([
    getVendorCoupon(vendor.id, couponId, now),
    listCouponScopeOptions(vendor.id),
  ]);
  if (!coupon) notFound();
  return (
    <>
      <PageHeader
        title={coupon.code}
        crumb="Offers & Coupons"
        subtitle={`Redeemed ${coupon.usedCount} time(s). Changes apply to new checkouts.`}
      />
      <CouponForm
        scope={scope}
        vendorName={vendor.businessName}
        defaults={{ validFrom: coupon.validFrom ?? now.toISOString(), validUntil: coupon.validUntil }}
        coupon={{
          id: coupon.id,
          usedCount: coupon.usedCount,
          values: {
            code: coupon.code,
            title: coupon.title,
            description: coupon.description,
            // Seeded "buy one get one" coupons are platform coupons; a vendor coupon is percent or flat.
            kind: coupon.kind === "flat" ? "flat" : "percent",
            ...(coupon.percentBps !== undefined ? { percentOff: coupon.percentBps / 100 } : {}),
            ...(coupon.flatPaise !== undefined ? { flatPaise: coupon.flatPaise } : {}),
            ...(coupon.maxDiscountPaise !== undefined ? { maxDiscountPaise: coupon.maxDiscountPaise } : {}),
            minOrderPaise: coupon.minOrderPaise,
            appliesTo: coupon.appliesTo,
            validFrom: coupon.validFrom ?? now.toISOString(),
            validUntil: coupon.validUntil,
            ...(coupon.usageLimit !== undefined ? { usageLimit: coupon.usageLimit } : {}),
            ...(coupon.perCustomerLimit !== undefined ? { perCustomerLimit: coupon.perCustomerLimit } : {}),
            venueIds: coupon.venueIds,
            movieIds: coupon.movieIds,
            eventIds: coupon.eventIds,
            showOnOffersPage: coupon.showOnOffersPage,
            gradient: coupon.gradient,
            terms: coupon.terms,
            status: coupon.status,
          },
        }}
      />
    </>
  );
}
