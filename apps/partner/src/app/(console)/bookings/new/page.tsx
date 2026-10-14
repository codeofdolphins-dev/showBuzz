import type { Metadata } from "next";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { EmptyState } from "@showbuzz/console-ui/DataTable";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getCounterPassListing, listCounterOptions } from "@showbuzz/core/services/partner/counter-sale.service";
import { getShowSeatBoard } from "@showbuzz/core/services/partner/seat-management.service";
import { isDateKey, istDateKey } from "@showbuzz/utils/dates";
import { CounterSale } from "@/components/bookings/CounterSale";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Counter booking" };

/**
 * Prototype booking-form.html: box-office sale. Date, show and listing are URL params, so the live seat map (or the
 * live pass counts) is loaded on the server for the vendor's own show only.
 */
export default async function CounterBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const current = await requireVendorPage("/bookings/new");
  const sp = await searchParams;
  const now = new Date();
  const rawDate = param(sp, "date") ?? "";
  const dateKey = isDateKey(rawDate) ? rawDate : istDateKey(now);
  const showId = param(sp, "show") ?? "";
  const eventId = param(sp, "event") ?? "";
  const suspended = current.vendor.status === "suspended";

  const result = await load(() =>
    Promise.all([
      listCounterOptions(current.vendor.id, dateKey, now),
      showId ? getShowSeatBoard(current.vendor.id, showId, now) : null,
      eventId ? getCounterPassListing(current.vendor.id, eventId, now) : null,
    ]),
  );

  return (
    <>
      <PageHeader
        title="Box Office POS & Ticket Booking"
        crumb="Bookings"
        subtitle="Sell tickets at your counter: pick the show and seats, take cash or UPI, and print the QR ticket."
      />
      {suspended ? (
        <Card>
          <EmptyState
            title="Counter sales are paused"
            description="Your account is suspended, so new tickets can't be sold. Please contact ShowBuzz."
          />
        </Card>
      ) : !result.ok ? (
        <Card>
          <EmptyState title="The box office couldn't be loaded" description="Please try again in a moment." />
        </Card>
      ) : (
        <CounterSale
          dateKey={dateKey}
          seated={result.data[0].seated}
          passes={result.data[0].passes}
          board={result.data[1] && !result.data[1].show.started ? result.data[1] : null}
          listing={result.data[2]}
          selectedId={showId || eventId}
        />
      )}
    </>
  );
}
