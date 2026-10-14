import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorVenue } from "@showbuzz/core/services/partner/venue.service";
import { ScreenForm } from "@/components/venues/ScreenForm";

export const metadata: Metadata = { title: "Add screen" };

export default async function NewScreenPage({ params }: PageProps<"/venues/[venueId]/screens/new">) {
  const { venueId } = await params;
  const { vendor } = await requireVendorPage(`/venues/${venueId}/screens/new`);
  const venue = await getVendorVenue(vendor.id, venueId, new Date());
  if (!venue) notFound();

  return (
    <>
      <PageHeader
        title="Add a screen"
        crumb={venue.name}
        subtitle="It starts with a simple layout (rows A–H, 12 seats); you shape it in the seat layout designer next."
      />
      <ScreenForm venueId={venue.id} />
    </>
  );
}
