import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { SeatSelector } from "@/components/public/seat-map/SeatSelector";
import { showIdSchema } from "@showbuzz/schemas/booking";
import { readHolderKey } from "@showbuzz/core/booking/hold-cookie";
import { getSeatState } from "@showbuzz/core/services/seat-hold.service";
import { buildSeatMap, loadSeatPlan } from "@showbuzz/core/services/seat-map.service";
import { getSettings } from "@showbuzz/core/services/settings.service";
import { getShowDetails } from "@showbuzz/core/services/show.service";

export const metadata: Metadata = { title: "Select Seats" };

const standSchema = z.coerce.number().int().min(0).max(2).optional().catch(undefined);

async function Seats({ params, searchParams }: PageProps<"/booking/[showId]/seats">) {
  const [{ showId }, query] = await Promise.all([params, searchParams]);
  await connection();

  const parsed = showIdSchema.safeParse(showId);
  const now = new Date();
  const show = parsed.success ? await getShowDetails(parsed.data, now) : undefined;
  const plan = show && (await loadSeatPlan(show.id));
  if (!show || !plan) notFound();

  const stand = standSchema.parse(Array.isArray(query.stand) ? query.stand[0] : query.stand);
  const [state, settings] = await Promise.all([getSeatState(show.id, await readHolderKey(), now), getSettings()]);
  return (
    <SeatSelector
      // Remount when the hold changes (e.g. it expired), so the selection starts from the server state.
      key={state.myExpiresAt?.toISOString() ?? "no-hold"}
      show={show}
      seatMap={buildSeatMap(show, plan, state)}
      maxTickets={settings.maxTicketsPerOrder}
      focusTier={stand}
    />
  );
}

export default function SeatSelectionPage(props: PageProps<"/booking/[showId]/seats">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
            <div className="h-12 skeleton" />
            <div className="h-56 skeleton" />
            <div className="h-72 skeleton" />
          </div>
        }
      >
        <Seats {...props} />
      </Suspense>
    </div>
  );
}
