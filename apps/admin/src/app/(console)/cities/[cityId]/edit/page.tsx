import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listCitiesAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CityForm } from "@/components/master/CityForm";

export const metadata: Metadata = { title: "Edit city" };

export default async function EditCityPage({ params }: PageProps<"/cities/[cityId]/edit">) {
  const { cityId } = await params;
  const { staff } = await requireStaffPage(`/cities/${cityId}/edit`);
  if (!hasPermission(staff.permissions, "cities:write")) return <NoAccess title="Edit city" />;
  const city = (await listCitiesAdmin(new Date())).find((c) => c.id === cityId);
  if (!city) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${city.name}`}
        crumb="Cities & Regions"
        subtitle={`${city.cinemas} active cinema(s) · ${city.todayShows} show(s) today`}
      />
      <Card className="max-w-2xl p-6">
        <CityForm
          cityId={city.id}
          defaults={{
            name: city.name,
            slug: city.slug,
            state: city.state,
            tier: city.tier,
            popular: city.popular,
            status: city.status,
          }}
        />
      </Card>
    </>
  );
}
