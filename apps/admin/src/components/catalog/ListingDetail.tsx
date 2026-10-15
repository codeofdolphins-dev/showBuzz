import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getListingAdmin } from "@showbuzz/core/services/admin/listing-admin.service";
import { LISTING_SECTIONS, type ListingKind } from "@showbuzz/schemas/admin-catalog";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { load } from "@/lib/load";
import { restoreListingAction, takeDownListingAction } from "@/app/_actions/catalog-tools";
import { listingStatusBadge } from "./ListingsList";

/** One vendor listing for staff: what it sells, how it's selling, recent bookings, and take down / restore. */
export async function ListingDetail({ kind, id }: { kind: ListingKind; id: string }) {
  const section = LISTING_SECTIONS[kind];
  const { staff } = await requireStaffPage(`${section.path}/${id}`);
  if (!hasPermission(staff.permissions, `${section.resource}:read`)) return <NoAccess title={section.many} />;
  const result = await load(() => getListingAdmin(kind, id, new Date()));
  if (!result.ok) return <TableError message="This listing couldn't be loaded. Try again." />;
  const listing = result.data;
  if (!listing) notFound();
  const canWrite = hasPermission(staff.permissions, `${section.resource}:write`);

  return (
    <>
      <PageHeader
        title={listing.title}
        crumb={section.many}
        subtitle={`${listing.category} · ${listing.venueName}, ${listing.cityName} · ${listing.when}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {listingStatusBadge(listing)}
            <a
              href={listing.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-admin-border bg-white px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Public page
            </a>
            {canWrite ? (
              listing.takedown ? (
                <PromptActionButton
                  label="Restore listing"
                  title={`Restore ${listing.title}?`}
                  description="It becomes visible and bookable again (unless the vendor switched it off). The vendor is notified."
                  confirmLabel="Restore"
                  action={restoreListingAction.bind(null, kind, listing.id)}
                  success="Listing restored."
                />
              ) : (
                <PromptActionButton
                  label="Take down"
                  title={`Take down ${listing.title}?`}
                  description="It disappears from showbuzz.com and can't be booked. Tickets already sold stay valid. The vendor sees your reason and can't undo this."
                  field={{
                    name: "reason",
                    label: "Reason (shown to the vendor)",
                    placeholder: "e.g. Misleading lineup",
                  }}
                  confirmLabel="Take down"
                  tone="danger"
                  variant="danger"
                  action={takeDownListingAction.bind(null, kind, listing.id)}
                  success="Listing taken down."
                />
              )
            ) : null}
          </div>
        }
      />

      {listing.takedown ? (
        <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <p className="font-bold text-admin-danger">
            Taken down {formatDateShort(new Date(listing.takedown.at))} by {listing.takedown.byName}
          </p>
          <p>Reason: {listing.takedown.reason}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-admin-dark">About</h2>
          <p className="text-xs leading-relaxed whitespace-pre-line text-admin-text">{listing.about}</p>
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Term label="Vendor">
              <Link href={`/vendors/${listing.vendorId}`} className="text-admin-indigo hover:underline">
                {listing.vendorName}
              </Link>
            </Term>
            {listing.language ? <Term label="Language">{listing.language}</Term> : null}
            {listing.durationLabel ? <Term label="Duration">{listing.durationLabel}</Term> : null}
            {listing.ageLimit ? <Term label="Age">{listing.ageLimit}</Term> : null}
            <Term label="Created">{formatDateShort(new Date(listing.createdAt))}</Term>
          </dl>
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-bold text-admin-dark">Sales</h2>
          <p className="font-mono text-2xl font-black text-admin-dark">
            {listing.sold.toLocaleString("en-IN")}
            <span className="text-sm font-semibold text-admin-subtle">
              {" "}
              / {listing.capacity.toLocaleString("en-IN")}
            </span>
          </p>
          <p className="text-[11px] text-admin-muted">
            {kind === "sport" ? "Seats sold of the stadium layout." : "Passes sold of the listing's capacity."}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-admin-border bg-slate-50/50 p-4">
          <h2 className="text-sm font-bold text-admin-dark">Ticket tiers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-bold">Tier</th>
                <th className="px-4 py-2.5 text-right font-bold">Price</th>
                <th className="px-4 py-2.5 text-right font-bold">Capacity</th>
                {kind === "sport" ? null : (
                  <>
                    <th className="px-4 py-2.5 text-right font-bold">Sold</th>
                    <th className="px-4 py-2.5 text-right font-bold">In checkout</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listing.tiers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-semibold text-admin-dark">{t.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(t.pricePaise, { exact: true })}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{t.capacity.toLocaleString("en-IN")}</td>
                  {kind === "sport" ? null : (
                    <>
                      <td className="px-4 py-2.5 text-right font-mono">{t.sold.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.reserved.toLocaleString("en-IN")}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-admin-border bg-slate-50/50 p-4">
          <h2 className="text-sm font-bold text-admin-dark">Latest bookings</h2>
        </div>
        {listing.bookings.length === 0 ? (
          <p className="p-6 text-center text-xs text-admin-muted">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Booking</th>
                  <th className="px-4 py-2.5 font-bold">Customer</th>
                  <th className="px-4 py-2.5 font-bold">Tickets</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listing.bookings.map((b) => (
                  <tr key={b.code}>
                    <td className="px-4 py-2.5 font-mono font-bold">
                      <Link href={`/bookings/${b.code}`} className="text-admin-indigo hover:underline">
                        {b.code}
                      </Link>
                      <span className="block font-sans text-[10px] font-normal text-admin-subtle">
                        {formatDateShort(new Date(b.bookedAt))}, {formatTime(new Date(b.bookedAt))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {b.customer}
                      {b.channel === "counter" ? (
                        <span className="block text-[10px] text-admin-subtle">Counter</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-admin-muted">
                      {b.tickets} ({b.ticketCount})
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">
                      {formatINR(b.totalPaise, { exact: true })}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}
