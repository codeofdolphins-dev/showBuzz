import type { Metadata } from "next";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CouponForm } from "@/components/marketing/CouponForm";

export const metadata: Metadata = { title: "Create promo code" };

export default async function NewCouponPage() {
  const { staff } = await requireStaffPage("/coupons/new");
  if (!hasPermission(staff.permissions, "coupons:write")) return <NoAccess title="Create promo code" />;
  return (
    <>
      <PageHeader
        title="Create promo code"
        crumb="Coupons & Promos"
        subtitle="A platform coupon: valid on every vendor's shows and listed on /offers. ShowBuzz funds no discount logic yet; the vendor's share is computed after discounts."
      />
      <CouponForm />
    </>
  );
}
