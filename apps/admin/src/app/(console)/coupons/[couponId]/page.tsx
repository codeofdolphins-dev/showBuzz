import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getPlatformCoupon } from "@showbuzz/core/services/admin/coupon-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CouponForm } from "@/components/marketing/CouponForm";

export const metadata: Metadata = { title: "Edit coupon" };

/** A platform coupon (vendor coupons answer 404 here: their vendor edits them). */
export default async function EditCouponPage({ params }: PageProps<"/coupons/[couponId]">) {
  const { couponId } = await params;
  const { staff } = await requireStaffPage(`/coupons/${couponId}`);
  if (!hasPermission(staff.permissions, "coupons:write")) return <NoAccess title="Edit coupon" />;
  const coupon = await getPlatformCoupon(couponId);
  if (!coupon) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${coupon.values.code}`}
        crumb="Coupons & Promos"
        subtitle={`Used ${coupon.usedCount} time(s). Changes apply to new checkouts.`}
      />
      <CouponForm couponId={couponId} defaults={coupon.values} used={coupon.usedCount} />
    </>
  );
}
