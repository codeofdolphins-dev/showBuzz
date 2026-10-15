import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CityForm } from "@/components/master/CityForm";

export const metadata: Metadata = { title: "Add city" };

export default async function NewCityPage() {
  const { staff } = await requireStaffPage("/cities/new");
  if (!hasPermission(staff.permissions, "cities:write")) return <NoAccess title="Add city" />;
  return (
    <>
      <PageHeader title="Add city" crumb="Cities & Regions" subtitle="Active cities appear in the public city picker." />
      <Card className="max-w-2xl p-6">
        <CityForm />
      </Card>
    </>
  );
}
