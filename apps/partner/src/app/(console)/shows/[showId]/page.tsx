import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Grid3x3 } from "lucide-react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorShow } from "@showbuzz/core/services/partner/show-schedule.service";
import { formatDateLong, formatTime, istDateKey } from "@showbuzz/utils/dates";
import { CancelShowButton, ShowEditor } from "@/components/shows/ShowEditor";
import { LinkButton } from "@/components/venues/LinkButton";

export const metadata: Metadata = { title: "Show" };

const STATUS_LABEL = { scheduled: "Scheduled", started: "Started", cancelled: "Cancelled" } as const;

/** One show: when and where, sales, prices/format (editable until it starts) and cancellation. */
export default async function ShowPage({ params }: PageProps<"/shows/[showId]">) {
  const { showId } = await params;
  const { vendor } = await requireVendorPage(`/shows/${showId}`);
  const show = await getVendorShow(vendor.id, showId, new Date());
  if (!show) notFound();
  const starts = new Date(show.startsAt);

  return (
    <>
      <PageHeader
        title={show.title}
        crumb="Shows"
        subtitle={`${show.venueName} · ${show.screenName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {show.status === "scheduled" ? (
              <LinkButton
                href={`/seat-layouts?tab=live&show=${show.id}&date=${istDateKey(starts)}`}
                variant="secondary"
              >
                <Grid3x3 className="h-4 w-4" aria-hidden /> Live seat map
              </LinkButton>
            ) : null}
            <CancelShowButton show={show} />
          </div>
        }
      />

      <Card className="grid grid-cols-1 gap-4 p-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Term label="Status">
          <StatusBadge
            tone={show.status === "scheduled" ? "success" : show.status === "cancelled" ? "danger" : "neutral"}
          >
            {STATUS_LABEL[show.status]}
          </StatusBadge>
          {show.generated ? <span className="ml-2 text-[11px] text-admin-subtle">Demo (auto)</span> : null}
        </Term>
        <Term label="Date (IST)">{formatDateLong(starts)}</Term>
        <Term label="Time (IST)">
          {formatTime(starts)}
          {show.endsAt ? ` – ${formatTime(new Date(show.endsAt))}` : ""}
        </Term>
        <Term label="Format & audio">{[show.format, show.language].filter(Boolean).join(" · ") || "—"}</Term>
        <Term label="Sold">
          {show.sold} of {show.capacity} seats
        </Term>
        <Term label="In checkout">{show.held} seats</Term>
      </Card>

      <ShowEditor show={show} />
    </>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</p>
      <div className="mt-0.5 font-semibold text-admin-dark">{children}</div>
    </div>
  );
}
