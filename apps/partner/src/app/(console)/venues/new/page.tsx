import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { VenueForm } from "@/components/venues/VenueForm";

export const metadata: Metadata = { title: "Add venue" };

export default async function NewVenuePage() {
  await requireVendorPage("/venues/new");
  const cities = await listCityOptions();
  return (
    <>
      <PageHeader
        title="Add a venue"
        crumb="Venues"
        subtitle="It appears on showbuzz.com as soon as you save it (active venues only)."
      />
      <VenueForm cities={cities} />
    </>
  );
}
