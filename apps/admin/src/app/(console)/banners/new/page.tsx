import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { BannerForm } from "@/components/marketing/BannerForm";

export const metadata: Metadata = { title: "Add banner" };

export default async function NewBannerPage() {
  const { staff } = await requireStaffPage("/banners/new");
  if (!hasPermission(staff.permissions, "banners:write")) return <NoAccess title="Add banner" />;
  const cities = await listCityOptions();
  return (
    <>
      <PageHeader title="Add home banner" crumb="Banners" subtitle="It joins the end of the carousel; reorder it from the list." />
      <Card className="max-w-3xl p-6">
        <BannerForm cities={cities} />
      </Card>
    </>
  );
}
