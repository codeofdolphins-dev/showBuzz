import type { Metadata } from "next";
import { List } from "lucide-react";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { param } from "@showbuzz/console-ui/search-params";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";
import { TicketScanner } from "@/components/bookings/TicketScanner";
import { LinkButton } from "@/components/venues/LinkButton";

export const metadata: Metadata = { title: "Scan Tickets" };

/** Prototype scan-qr.html: gate check-in for this vendor's tickets (camera QR scan or typed booking code). */
export default async function ScanTicketsPage({ searchParams }: PageProps<"/scan-tickets">) {
  await requireVendorPage("/scan-tickets");
  const code = bookingCodeSchema.safeParse(param(await searchParams, "code"));
  return (
    <>
      <PageHeader
        title="Scan QR Code & Gate Check-In"
        crumb="Scan Tickets"
        subtitle="Each ticket is admitted once. Only your own shows' tickets are accepted."
        actions={
          <LinkButton href="/bookings" variant="secondary">
            <List className="h-4 w-4" aria-hidden /> View all bookings
          </LinkButton>
        }
      />
      <TicketScanner initialCode={code.success ? code.data : ""} />
    </>
  );
}
