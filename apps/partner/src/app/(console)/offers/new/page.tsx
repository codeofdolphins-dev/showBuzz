import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listCouponScopeOptions } from "@showbuzz/core/services/partner/coupon.service";
import { CouponForm } from "@/components/offers/CouponForm";

export const metadata: Metadata = { title: "Create coupon" };

const DAY_MS = 86_400_000;

export default async function NewCouponPage() {
  const { vendor } = await requireVendorPage("/offers/new");
  const scope = await listCouponScopeOptions(vendor.id);
  // Whole minutes, so the IST date-time inputs show a clean start.
  const now = new Date();
  now.setSeconds(0, 0);
  return (
    <>
      <PageHeader
        title="Create a coupon"
        crumb="Offers & Coupons"
        subtitle="Customers apply it at checkout. It works only on your shows."
      />
      <CouponForm
        scope={scope}
        vendorName={vendor.businessName}
        defaults={{ validFrom: now.toISOString(), validUntil: new Date(now.getTime() + 30 * DAY_MS).toISOString() }}
      />
    </>
  );
}
