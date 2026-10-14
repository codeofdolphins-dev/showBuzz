import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getSeatLayout } from "@showbuzz/core/services/partner/venue.service";
import { SeatLayoutDesigner } from "@/components/seats/SeatLayoutDesigner";

export const metadata: Metadata = { title: "Seat Layout Designer" };

/** Prototype seat-layout.html for one screen. Another vendor's venue or screen → 404. */
export default async function SeatLayoutPage({ params }: PageProps<"/venues/[venueId]/screens/[screenId]/layout">) {
  const { venueId, screenId } = await params;
  const { vendor } = await requireVendorPage(`/venues/${venueId}/screens/${screenId}/layout`);
  const layout = await getSeatLayout(vendor.id, venueId, screenId, new Date());
  if (!layout) notFound();

  return (
    <>
      <PageHeader
        title={`${layout.screen.name}: seat layout`}
        crumb={layout.venue.name}
        subtitle="Design the seat grid: categories and default prices, rows, aisles, wheelchair spots and blocked seats."
        actions={
          <Link href={`/venues/${layout.venue.id}`} className="text-xs font-bold text-admin-indigo hover:underline">
            Back to {layout.venue.name}
          </Link>
        }
      />
      {layout.lockedSeats.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-admin-border bg-white p-3 text-xs text-admin-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-admin-dark" aria-hidden />
          {layout.lockedSeats.length} seat(s) are sold or in checkout for the {layout.upcomingShows} upcoming show(s) on
          this screen. They keep their row, number and category until those shows have run.
        </p>
      ) : null}
      {/* Remounts with the saved version after each save (the designer saves against `updatedAt`). */}
      <SeatLayoutDesigner key={layout.updatedAt} venueId={layout.venue.id} layout={layout} />
    </>
  );
}
