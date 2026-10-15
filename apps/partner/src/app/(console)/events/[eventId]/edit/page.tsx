import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getMasterOptions } from "@showbuzz/core/services/master-data.service";
import { getVendorEvent } from "@showbuzz/core/services/partner/listing.service";
import { listVenueScreenOptions } from "@showbuzz/core/services/partner/show-schedule.service";
import { EVENT_KIND_LABELS } from "@showbuzz/schemas/partner-listing";
import { EventForm } from "@/components/events/EventForm";

export const metadata: Metadata = { title: "Edit listing" };

/** One of the vendor's listings; another vendor's id answers 404. */
export default async function EditEventPage({ params }: PageProps<"/events/[eventId]/edit">) {
  const { eventId } = await params;
  const { vendor } = await requireVendorPage(`/events/${eventId}/edit`);
  const [event, venues, options] = await Promise.all([
    getVendorEvent(vendor.id, eventId),
    listVenueScreenOptions(vendor.id),
    getMasterOptions(),
  ]);
  if (!event) notFound();
  const labels = EVENT_KIND_LABELS[event.kind];
  return (
    <>
      <PageHeader
        title={`Edit ${event.values.title}`}
        crumb={labels.many}
        subtitle={`${labels.one} · /${event.slug}`}
      />
      {event.takedown ? (
        <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <p className="font-bold text-admin-danger">Taken down by ShowBuzz</p>
          <p>
            This listing is hidden from showbuzz.com and can&apos;t be booked. Reason: {event.takedown.reason}. Tickets
            already sold stay valid. Contact your ShowBuzz account manager to have it restored.
          </p>
        </div>
      ) : null}
      <EventForm
        kind={event.kind}
        venues={venues}
        categories={options.eventCategories[event.kind]}
        event={{ id: event.id, values: event.values, usage: event.usage, locked: event.locked }}
      />
    </>
  );
}
