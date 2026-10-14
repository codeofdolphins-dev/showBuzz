import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorEvent } from "@showbuzz/core/services/partner/listing.service";
import { listVenueScreenOptions } from "@showbuzz/core/services/partner/show-schedule.service";
import { EVENT_KIND_LABELS } from "@showbuzz/schemas/partner-listing";
import { EventForm } from "@/components/events/EventForm";

export const metadata: Metadata = { title: "Edit listing" };

/** One of the vendor's listings; another vendor's id answers 404. */
export default async function EditEventPage({ params }: PageProps<"/events/[eventId]/edit">) {
  const { eventId } = await params;
  const { vendor } = await requireVendorPage(`/events/${eventId}/edit`);
  const [event, venues] = await Promise.all([getVendorEvent(vendor.id, eventId), listVenueScreenOptions(vendor.id)]);
  if (!event) notFound();
  const labels = EVENT_KIND_LABELS[event.kind];
  return (
    <>
      <PageHeader
        title={`Edit ${event.values.title}`}
        crumb={labels.many}
        subtitle={`${labels.one} · /${event.slug}`}
      />
      <EventForm
        kind={event.kind}
        venues={venues}
        event={{ id: event.id, values: event.values, usage: event.usage, locked: event.locked }}
      />
    </>
  );
}
