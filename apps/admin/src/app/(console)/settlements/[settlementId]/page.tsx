import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getSettlement } from "@showbuzz/core/services/admin/settlement.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort } from "@showbuzz/utils/dates";
import { markSettlementPaidAction, voidSettlementAction } from "@/app/_actions/billing";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { SettlementLinesTable, SettlementSummary, signedINR } from "@/components/billing/SettlementLines";

export const metadata: Metadata = { title: "Payout" };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}

/** One payout: its bookings, the vendor's bank account (masked) and the "paid" record. */
export default async function SettlementPage({ params }: PageProps<"/settlements/[settlementId]">) {
  const { settlementId } = await params;
  const { staff } = await requireStaffPage(`/settlements/${settlementId}`);
  if (!hasPermission(staff.permissions, "settlements:read")) return <NoAccess title="Payout" />;
  const s = await getSettlement(settlementId);
  if (!s) notFound();
  const canWrite = hasPermission(staff.permissions, "settlements:write") && s.status === "pending";
  const owes = s.netPayoutPaise < 0;

  return (
    <>
      <PageHeader
        title={`Payout ${s.code}`}
        crumb="Vendor Payouts"
        subtitle={`${s.vendorName} · ${formatDateShort(new Date(s.periodFrom))} – ${s.periodToKey}`}
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <PromptActionButton
                label={owes ? "Mark received" : "Mark paid"}
                variant="primary"
                title={
                  owes
                    ? `Record ${signedINR(-s.netPayoutPaise)} received`
                    : `Record transfer of ${signedINR(s.netPayoutPaise)}`
                }
                description={`${s.vendorName} · ${s.bankAccount.holderName} · ${s.bankAccount.accountNumberMasked} · ${s.bankAccount.ifsc}`}
                field={{ name: "reference", label: "Bank reference (UTR)", placeholder: "e.g. HDFCN52026101400123" }}
                confirmLabel={owes ? "Mark received" : "Mark paid"}
                action={markSettlementPaidAction.bind(null, s.id)}
                success={`${s.code} recorded as paid.`}
              />
              <PromptActionButton
                label="Void"
                variant="ghost"
                tone="danger"
                title={`Void ${s.code}?`}
                description="For a payout created in error. Its bookings are released and can go into another payout."
                field={{ name: "reason", label: "Reason" }}
                confirmLabel="Void payout"
                action={voidSettlementAction.bind(null, s.id)}
                success={`${s.code} voided.`}
              />
            </div>
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
        <SettlementSummary
          totals={{
            bookings: s.lines.length,
            clawbacks: s.clawbackLines.length,
            grossSalesPaise: s.grossSalesPaise,
            commissionPaise: s.commissionPaise,
            counterCollectedPaise: s.counterCollectedPaise,
            refundsPaise: s.refundsPaise,
            netPayoutPaise: s.netPayoutPaise,
          }}
        />
        <Card className="p-5">
          <dl className="space-y-3">
            <Fact label="Status">
              <StatusBadge status={s.status} />
            </Fact>
            <Fact label="Vendor">
              <Link href={`/vendors/${s.vendorId}`} className="text-admin-indigo hover:underline">
                {s.vendorName}
              </Link>{" "}
              <span className="font-normal text-admin-muted">({s.billingModel})</span>
            </Fact>
            <Fact label="Bank account">
              {s.bankAccount.holderName || "—"}
              <span className="block font-mono font-normal text-admin-muted">
                {s.bankAccount.accountNumberMasked} · {s.bankAccount.ifsc}
              </span>
            </Fact>
            {s.reference ? <Fact label="Reference">{s.reference}</Fact> : null}
            {s.paidAt ? <Fact label="Paid on">{formatDateShort(new Date(s.paidAt))}</Fact> : null}
            {s.voidReason ? <Fact label="Void reason">{s.voidReason}</Fact> : null}
            <Fact label="Created">{formatDateShort(new Date(s.createdAt))}</Fact>
          </dl>
        </Card>
      </div>
      <SettlementLinesTable
        title={s.status === "void" ? "Bookings (released)" : "Bookings in this payout"}
        lines={s.lines}
      />
      <SettlementLinesTable title="Cancellation adjustments" lines={s.clawbackLines} />
    </>
  );
}
