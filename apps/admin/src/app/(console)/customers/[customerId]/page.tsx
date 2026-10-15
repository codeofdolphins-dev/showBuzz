import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DataTable, EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { ADMIN_BOOKING_SORT_FIELDS, listBookingsAdmin } from "@showbuzz/core/services/admin/booking-admin.service";
import { getCustomerDetail } from "@showbuzz/core/services/admin/customer-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { blockCustomerAction, unblockCustomerAction } from "@/app/_actions/operations";
import { BOOKING_COLUMNS } from "@/components/bookings/columns";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Customer" };

const when = (iso?: string) => (iso ? `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}` : "Never");

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-admin-muted">{label}</span>
      <span className="text-right font-semibold text-admin-dark">{children}</span>
    </div>
  );
}

/** Prototype customer-details.html: profile, totals and bookings across every vendor; block / unblock. */
export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[customerId]">) {
  const { customerId } = await params;
  const { staff } = await requireStaffPage(`/customers/${customerId}`);
  if (!hasPermission(staff.permissions, "customers:read")) return <NoAccess title="Customer" />;
  const sp = await searchParams;
  const listParams = parseListParams(sp, {
    sortable: ADMIN_BOOKING_SORT_FIELDS,
    defaultSort: { field: "bookedAt", direction: "desc" },
    defaultLimit: 10,
  });
  const customer = await getCustomerDetail(customerId, new Date());
  if (!customer) notFound();
  const bookings = hasPermission(staff.permissions, "bookings:read")
    ? await load(() => listBookingsAdmin({ ...listParams, customerId }))
    : null;
  const canWrite = hasPermission(staff.permissions, "customers:write");

  return (
    <>
      <PageHeader
        title={`Customer Profile: ${customer.name}`}
        crumb="Customers Database"
        subtitle={`Joined ${formatDateShort(new Date(customer.joinedAt))}`}
        actions={
          canWrite && customer.status === "active" ? (
            <PromptActionButton
              label="Block customer"
              title={`Block ${customer.name}?`}
              description="They are signed out on every device and can't sign in or book. Their existing tickets stay valid."
              field={{ name: "reason", label: "Reason", placeholder: "e.g. payment fraud reported by the bank" }}
              confirmLabel="Block"
              tone="danger"
              variant="danger"
              action={blockCustomerAction.bind(null, customer.id)}
              success="Customer blocked and signed out."
            />
          ) : canWrite && customer.status === "blocked" ? (
            <PromptActionButton
              label="Unblock customer"
              title={`Unblock ${customer.name}?`}
              description="They can sign in and book again."
              confirmLabel="Unblock"
              action={unblockCustomerAction.bind(null, customer.id)}
              success="Customer unblocked."
            />
          ) : null
        }
      />
      {customer.status === "blocked" ? (
        <p role="status" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-admin-danger">
          Blocked {when(customer.blockedAt)}
          {customer.blockReason ? `: ${customer.blockReason}` : ""}
        </p>
      ) : null}
      {customer.status === "deleted" ? (
        <p role="status" className="rounded-lg border border-admin-border bg-slate-50 px-4 py-3 text-xs text-admin-muted">
          The customer deleted this account {when(customer.deletedAt)}. It is kept anonymised for booking records.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-bold text-admin-dark">Profile</h2>
          <Fact label="Status">
            <StatusBadge status={customer.status} />
          </Fact>
          <Fact label="Mobile">{customer.phone ?? "—"}</Fact>
          <Fact label="Email">{customer.email ?? "—"}</Fact>
          <Fact label="Last sign-in">{when(customer.lastLoginAt)}</Fact>
          <Fact label="Signed-in devices">{customer.activeSessions}</Fact>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-bold text-admin-dark">Totals</h2>
          <Fact label="Orders">{customer.orders}</Fact>
          <Fact label="Lifetime spend">{formatINR(customer.spendPaise)}</Fact>
          <Fact label="Reviews written">{customer.reviews}</Fact>
          <Fact label="Gift cards bought">{customer.giftCardsBought}</Fact>
        </Card>
      </div>
      {bookings ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-admin-dark">Recent booking transactions</h2>
          {!bookings.ok ? (
            <TableError />
          ) : (
            <DataTable
              columns={BOOKING_COLUMNS}
              rows={bookings.data.rows}
              rowKey={(b) => b.code}
              total={bookings.data.total}
              params={listParams}
              pathname={`/customers/${customer.id}`}
              searchParams={sp}
              caption="Customer bookings"
              empty={<EmptyState title="No bookings yet" />}
            />
          )}
        </section>
      ) : null}
    </>
  );
}
