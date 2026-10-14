import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorVenue } from "@showbuzz/core/services/partner/venue.service";
import { VENUE_KIND_LABELS } from "@showbuzz/schemas/partner-venue";
import { LinkButton } from "@/components/venues/LinkButton";
import { ScreenList } from "@/components/venues/ScreenList";

export const metadata: Metadata = { title: "Venue" };

/** One venue: its details and its screens (prototype cinema detail + screens.html). Another vendor's id → 404. */
export default async function VenuePage({ params }: PageProps<"/venues/[venueId]">) {
  const { venueId } = await params;
  const { vendor } = await requireVendorPage(`/venues/${venueId}`);
  const venue = await getVendorVenue(vendor.id, venueId, new Date());
  if (!venue) notFound();

  const capacity = venue.screens.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <>
      <PageHeader
        title={venue.name}
        crumb="Venues"
        subtitle={`${VENUE_KIND_LABELS[venue.kind]} · ${venue.cityName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/venues/${venue.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" aria-hidden /> Edit venue
            </LinkButton>
            <LinkButton href={`/venues/${venue.id}/screens/new`}>
              <Plus className="h-4 w-4" aria-hidden /> Add screen
            </LinkButton>
          </div>
        }
      />

      <Card className="grid grid-cols-1 gap-4 p-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Term label="Status">
          <StatusBadge status={venue.status} />
        </Term>
        <Term label="Address">{venue.address}</Term>
        <Term label="Box office">{venue.phone || "—"}</Term>
        <Term label="Capacity">
          {capacity.toLocaleString("en-IN")} seats on {venue.screens.length} screen
          {venue.screens.length === 1 ? "" : "s"}
        </Term>
        <Term label="URL name">
          <span className="font-mono">/{venue.slug}</span>
        </Term>
        <Term label="Cancellations">
          {venue.cancellationAllowed ? "Allowed (your policy applies)" : "Not allowed here"}
        </Term>
        <Term label="Amenities" wide>
          {venue.amenities.length > 0 ? venue.amenities.join(" · ") : "—"}
        </Term>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-admin-border bg-slate-50/50 p-4">
          <h2 className="text-sm font-bold text-admin-dark">Screens & auditoriums</h2>
          <p className="text-[11px] text-admin-subtle">Capacity, formats and the seat map of each screen.</p>
        </div>
        <ScreenList venueId={venue.id} screens={venue.screens} />
      </Card>
    </>
  );
}

function Term({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</p>
      <div className="mt-0.5 font-semibold text-admin-dark">{children}</div>
    </div>
  );
}
