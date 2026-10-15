import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listBannersAdmin } from "@showbuzz/core/services/admin/banner-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { deleteBannerAction, moveBannerAction, setBannerActiveAction } from "@/app/_actions/marketing";
import { MoveButtons } from "@/components/common/MoveButtons";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Marketing Banners" };

const when = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

/**
 * Prototype banners.html: the home hero carousel, in display order (up/down instead of drag and drop). With no live
 * banner for the visitor's city, the home page shows its built-in slides.
 */
export default async function BannersPage() {
  const { staff } = await requireStaffPage("/banners");
  if (!hasPermission(staff.permissions, "banners:read")) return <NoAccess title="Marketing Banners" />;
  const result = await load(() => listBannersAdmin(new Date()));
  const canWrite = hasPermission(staff.permissions, "banners:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Marketing Banners & Homepage Carousel"
        crumb="Banners"
        subtitle="Slides of the showbuzz.com home hero, in this order. Each can target one city and run between dates."
        actions={
          canWrite ? (
            <LinkButton href="/banners/new">
              <Plus className="h-4 w-4" aria-hidden /> Add banner
            </LinkButton>
          ) : null
        }
      />
      {!result.ok ? (
        <TableError />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No banners yet"
            description="The home page shows its built-in slides until you add one."
          />
        </Card>
      ) : (
        <ol className="space-y-3">
          {rows.map((b, i) => (
            <li key={b.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- banner preview from a remote URL */}
                <img
                  src={b.imageUrl}
                  alt=""
                  className="aspect-[21/9] w-full rounded-lg border border-admin-border object-cover sm:w-56"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-admin-subtle">#{i + 1}</span>
                    <h2 className="text-sm font-bold text-admin-dark">{b.title}</h2>
                    {b.live ? (
                      <StatusBadge tone="success">Live</StatusBadge>
                    ) : b.active ? (
                      <StatusBadge tone="warning">Scheduled / ended</StatusBadge>
                    ) : (
                      <StatusBadge status="inactive" />
                    )}
                  </div>
                  <p className="text-[11px] text-admin-muted">
                    Target: {b.cityName} • CTA: {b.ctaLabel} → <span className="font-mono">{b.linkUrl}</span>
                  </p>
                  {b.startsAt || b.endsAt ? (
                    <p className="text-[11px] text-admin-subtle">
                      {b.startsAt ? `From ${when(b.startsAt)}` : "Now"} {b.endsAt ? `until ${when(b.endsAt)}` : "onwards"}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MoveButtons
                      id={b.id}
                      label={b.title}
                      first={i === 0}
                      last={i === rows.length - 1}
                      action={moveBannerAction}
                    />
                    <Link
                      href={`/banners/${b.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${b.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                    <PromptActionButton
                      label={b.active ? "Switch off" : "Switch on"}
                      title={b.active ? "Switch this banner off?" : "Switch this banner on?"}
                      confirmLabel={b.active ? "Switch off" : "Switch on"}
                      action={setBannerActiveAction.bind(null, b.id, !b.active)}
                      success={b.active ? "Banner switched off." : "Banner switched on."}
                    />
                    <PromptActionButton
                      label="Delete"
                      title="Delete this banner?"
                      description="It disappears from the home page. This can't be undone."
                      confirmLabel="Delete"
                      tone="danger"
                      variant="ghost"
                      action={deleteBannerAction.bind(null, b.id)}
                      success="Banner deleted."
                    />
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
