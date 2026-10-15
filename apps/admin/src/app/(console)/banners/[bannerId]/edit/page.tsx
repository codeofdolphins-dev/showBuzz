import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getBannerValues } from "@showbuzz/core/services/admin/banner-admin.service";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { BannerForm } from "@/components/marketing/BannerForm";

export const metadata: Metadata = { title: "Edit banner" };

export default async function EditBannerPage({ params }: PageProps<"/banners/[bannerId]/edit">) {
  const { bannerId } = await params;
  const { staff } = await requireStaffPage(`/banners/${bannerId}/edit`);
  if (!hasPermission(staff.permissions, "banners:write")) return <NoAccess title="Edit banner" />;
  const values = await getBannerValues(bannerId);
  if (!values) notFound();
  const cities = await listCityOptions(values.cityId || undefined);
  return (
    <>
      <PageHeader title={`Edit "${values.title}"`} crumb="Banners" />
      <Card className="max-w-3xl p-6">
        <BannerForm bannerId={bannerId} defaults={values} cities={cities} />
      </Card>
    </>
  );
}
