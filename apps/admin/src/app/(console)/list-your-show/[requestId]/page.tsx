import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getShowRequest } from "@showbuzz/core/services/admin/show-request.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { AddShowRequestNote, ShowRequestStatus } from "@/components/requests/ShowRequestControls";

export const metadata: Metadata = { title: "Listing request" };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}

/** One list-your-show request: what the organiser sent, staff notes, status and "Create vendor". */
export default async function ShowRequestPage({ params }: PageProps<"/list-your-show/[requestId]">) {
  const { requestId } = await params;
  const { staff } = await requireStaffPage(`/list-your-show/${requestId}`);
  if (!hasPermission(staff.permissions, "list-your-show:read")) return <NoAccess title="Listing request" />;
  const request = await getShowRequest(requestId);
  if (!request) notFound();
  const canWrite = hasPermission(staff.permissions, "list-your-show:write");
  const canCreateVendor = hasPermission(staff.permissions, "organisers:write");

  return (
    <>
      <PageHeader
        title={request.companyName || request.name}
        crumb="List Your Show Requests"
        subtitle={`${request.reference} · received ${formatDateShort(new Date(request.createdAt))}`}
        actions={
          request.vendorId ? (
            <LinkButton href={`/vendors/${request.vendorId}`} variant="secondary">
              Open vendor {request.vendorName ? `· ${request.vendorName}` : ""}
            </LinkButton>
          ) : canCreateVendor ? (
            <LinkButton href={`/vendors/new?lead=${request.id}`}>
              <UserPlus className="h-4 w-4" aria-hidden /> Create vendor
            </LinkButton>
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
        <Card className="space-y-4 p-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="Organiser">{request.name}</Fact>
            <Fact label="Company / production">{request.companyName || "—"}</Fact>
            <Fact label="Email">
              <a href={`mailto:${request.email}`} className="text-admin-indigo hover:underline">
                {request.email}
              </a>
            </Fact>
            <Fact label="Mobile">{request.phone || "—"}</Fact>
            <Fact label="Category">{request.category || "—"}</Fact>
            <Fact label="City">{request.city || "—"}</Fact>
            <Fact label="Expected audience">{request.capacity || "—"}</Fact>
          </dl>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">Overview</p>
            <p className="mt-1 text-xs whitespace-pre-line text-admin-text">
              {request.overview || "No details given."}
            </p>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          {canWrite ? (
            <ShowRequestStatus id={request.id} status={request.status} />
          ) : (
            <Fact label="Status">
              <StatusBadge status={request.status} />
            </Fact>
          )}
          {request.vendorId ? (
            <p className="text-[11px] text-admin-muted">
              A vendor was created from this request:{" "}
              <Link href={`/vendors/${request.vendorId}`} className="font-bold text-admin-indigo hover:underline">
                {request.vendorName ?? "open vendor"}
              </Link>
              .
            </p>
          ) : null}
        </Card>
      </div>
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-bold text-admin-dark">Notes</h2>
        {request.notesList.length === 0 ? (
          <p className="text-xs text-admin-muted">No notes yet.</p>
        ) : (
          <ol className="space-y-3">
            {request.notesList.map((n, i) => (
              <li key={i} className="rounded-lg border border-admin-border bg-slate-50 px-3 py-2">
                <p className="text-xs whitespace-pre-line text-admin-text">{n.text}</p>
                <p className="mt-1 text-[10px] text-admin-subtle">
                  {n.staffName} · {formatDateShort(new Date(n.at))}, {formatTime(new Date(n.at))}
                </p>
              </li>
            ))}
          </ol>
        )}
        {canWrite ? <AddShowRequestNote id={request.id} /> : null}
      </Card>
    </>
  );
}
