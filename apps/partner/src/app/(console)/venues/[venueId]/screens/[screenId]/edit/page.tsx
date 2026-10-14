import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorVenue } from "@showbuzz/core/services/partner/venue.service";
import { ScreenForm } from "@/components/venues/ScreenForm";

export const metadata: Metadata = { title: "Edit screen" };

export default async function EditScreenPage({ params }: PageProps<"/venues/[venueId]/screens/[screenId]/edit">) {
  const { venueId, screenId } = await params;
  const { vendor } = await requireVendorPage(`/venues/${venueId}/screens/${screenId}/edit`);
  const venue = await getVendorVenue(vendor.id, venueId, new Date());
  const screen = venue?.screens.find((s) => s.id === screenId);
  if (!venue || !screen) notFound();

  return (
    <>
      <PageHeader title={`Edit ${screen.name}`} crumb={venue.name} />
      <ScreenForm
        venueId={venue.id}
        screen={{
          id: screen.id,
          values: {
            name: screen.name,
            layoutType: screen.layoutType,
            formats: screen.formats,
            soundSystem: screen.soundSystem,
          },
        }}
      />
    </>
  );
}
