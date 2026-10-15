import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { getVendorVenue } from "@showbuzz/core/services/partner/venue.service";
import { VenueForm } from "@/components/venues/VenueForm";

export const metadata: Metadata = { title: "Edit venue" };

export default async function EditVenuePage({ params }: PageProps<"/venues/[venueId]/edit">) {
  const { venueId } = await params;
  const { vendor } = await requireVendorPage(`/venues/${venueId}/edit`);
  const venue = await getVendorVenue(vendor.id, venueId, new Date());
  if (!venue) notFound();
  const cities = await listCityOptions(venue.cityId);

  return (
    <>
      <PageHeader title={`Edit ${venue.name}`} crumb="Venues" />
      <VenueForm
        cities={cities}
        venue={{
          id: venue.id,
          values: {
            kind: venue.kind,
            name: venue.name,
            slug: venue.slug,
            cityId: venue.cityId,
            address: venue.address,
            phone: venue.phone,
            amenities: venue.amenities,
            cancellationAllowed: venue.cancellationAllowed,
            status: venue.status,
          },
        }}
      />
    </>
  );
}
