import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVenueScreenOptions } from "@showbuzz/core/services/partner/show-schedule.service";
import { eventKindSchema } from "@showbuzz/schemas/event";
import { EVENT_KIND_LABELS } from "@showbuzz/schemas/partner-listing";
import { EventForm } from "@/components/events/EventForm";

export const metadata: Metadata = { title: "New listing" };

/** Prototype event-form.html, for the kind in `?kind=` (events, plays, sports, activities). */
export default async function NewEventPage({ searchParams }: PageProps<"/events/new">) {
  const { vendor } = await requireVendorPage("/events/new");
  const kind = eventKindSchema.catch("event").parse(param(await searchParams, "kind"));
  const venues = await listVenueScreenOptions(vendor.id);
  const labels = EVENT_KIND_LABELS[kind];
  return (
    <>
      <PageHeader
        title={`New ${labels.one.toLowerCase()}`}
        crumb={labels.many}
        subtitle="It goes on sale on ShowBuzz as soon as you save it (unless you set it inactive)."
      />
      <EventForm kind={kind} venues={venues} />
    </>
  );
}
