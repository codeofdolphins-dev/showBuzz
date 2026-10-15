import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listStreamsAdmin } from "@showbuzz/core/services/admin/stream-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDuration } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { moveStreamAction } from "@/app/_actions/catalog-tools";
import { MoveButtons } from "@/components/common/MoveButtons";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Online Streams" };

/**
 * Prototype streaming.html: the rent/buy titles on showbuzz.com/stream, in shelf order (up/down). Platform-owned;
 * inactive titles stay listed here but are hidden publicly.
 */
export default async function StreamingPage() {
  const { staff } = await requireStaffPage("/streaming");
  if (!hasPermission(staff.permissions, "streaming:read")) return <NoAccess title="Online Streams" />;
  const result = await load(() =>
    listStreamsAdmin({ page: 1, limit: 200, q: "", sort: { field: "sortOrder", direction: "asc" } }),
  );
  const canWrite = hasPermission(staff.permissions, "streaming:write");
  const rows = result.ok ? result.data.rows : [];

  return (
    <>
      <PageHeader
        title="Online Streams & Video on Demand"
        crumb="Online Streams"
        subtitle="Titles customers can rent or buy on showbuzz.com/stream, in shelf order. The featured title leads the page."
        actions={
          canWrite ? (
            <LinkButton href="/streaming/new">
              <Plus className="h-4 w-4" aria-hidden /> Add title
            </LinkButton>
          ) : null
        }
      />
      {!result.ok ? (
        <TableError />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No stream titles yet" description="Add a title to show it on /stream." />
        </Card>
      ) : (
        <ol className="space-y-3">
          {rows.map((s, i) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- poster preview (Unsplash or Media Library) */}
                <img
                  src={s.poster}
                  alt=""
                  className="h-24 w-16 shrink-0 rounded border border-admin-border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-admin-subtle">#{i + 1}</span>
                    <h2 className="text-sm font-bold text-admin-dark">{s.title}</h2>
                    {s.featured ? <StatusBadge tone="indigo">Featured</StatusBadge> : null}
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-[11px] text-admin-muted">
                    {s.category}
                    {s.badge ? ` · ${s.badge}` : ""} · {formatDuration(s.durationMinutes)} · Rating{" "}
                    {s.rating.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-admin-text">
                    Rent {formatINR(s.rentPricePaise)}
                    {s.buyPricePaise ? ` · Buy ${formatINR(s.buyPricePaise)}` : " · Rent only"} ·{" "}
                    <span className="font-mono text-admin-subtle">/stream · {s.slug}</span>
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-1.5">
                    <MoveButtons
                      id={s.id}
                      label={s.title}
                      first={i === 0}
                      last={i === rows.length - 1}
                      action={moveStreamAction}
                    />
                    <Link
                      href={`/streaming/${s.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${s.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
