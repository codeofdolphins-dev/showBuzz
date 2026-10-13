import { connection } from "next/server";
import { Suspense } from "react";
import type { EventListing } from "@showbuzz/schemas/event";
import { getTierAvailability } from "@showbuzz/core/services/availability.service";
import { TierPicker } from "./TierPicker";

type TierPickerProps = Parameters<typeof TierPicker>[0];

interface LiveTierPickerProps extends Omit<TierPickerProps, "eventId" | "tiers"> {
  listing: EventListing;
}

/**
 * TierPicker with live "left" counts. The listing page itself is cached; availability changes with every sale,
 * so it streams in per request behind this Suspense boundary.
 */
export function LiveTierPicker(props: LiveTierPickerProps) {
  return (
    <Suspense fallback={<div className="h-48 skeleton" />}>
      <WithAvailability {...props} />
    </Suspense>
  );
}

async function WithAvailability({ listing, ...pickerProps }: LiveTierPickerProps) {
  await connection();
  const available = await getTierAvailability(listing, new Date());
  const tiers = listing.ticketTiers.map((t) => ({ ...t, available: available[t.id] ?? 0 }));
  return <TierPicker eventId={listing.id} tiers={tiers} {...pickerProps} />;
}
