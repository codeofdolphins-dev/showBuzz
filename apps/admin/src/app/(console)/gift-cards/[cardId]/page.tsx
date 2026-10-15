import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getGiftCardAdmin } from "@showbuzz/core/services/admin/gift-card-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { cancelGiftCardAction } from "@/app/_actions/marketing";
import { PromptActionButton } from "@/components/common/PromptActionButton";

export const metadata: Metadata = { title: "Gift card" };

const when = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

const ENTRY_LABELS = {
  purchase: "Bought",
  issue: "Issued (complimentary)",
  redeem: "Spent on a booking",
  refund: "Returned (booking cancelled)",
  cancel: "Cancelled (balance voided)",
} as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-admin-muted">{label}</span>
      <span className="text-right font-semibold text-admin-dark">{children}</span>
    </div>
  );
}

/** One gift card: buyer or issuer, recipient, balance and its ledger; cancel (refunds an unused purchased card). */
export default async function GiftCardPage({ params }: PageProps<"/gift-cards/[cardId]">) {
  const { cardId } = await params;
  const { staff } = await requireStaffPage(`/gift-cards/${cardId}`);
  if (!hasPermission(staff.permissions, "gift-cards:read")) return <NoAccess title="Gift card" />;
  const card = await getGiftCardAdmin(cardId, new Date());
  if (!card) notFound();
  const canCancel =
    hasPermission(staff.permissions, "gift-cards:write") &&
    (card.status === "active" || (card.status === "cancelled" && card.refundOnCancel));

  return (
    <>
      <PageHeader
        title={card.code}
        crumb="Gift Cards"
        subtitle={`${card.source === "complimentary" ? "Complimentary" : "Bought online"} · issued ${when(card.createdAt)}`}
        actions={
          canCancel ? (
            <PromptActionButton
              label={card.status === "cancelled" ? "Retry refund" : "Cancel card"}
              title={card.status === "cancelled" ? "Retry the buyer's refund?" : "Cancel this gift card?"}
              description={
                card.refundOnCancel
                  ? `It was never used, so the buyer is refunded the full ${formatINR(card.amountPaise)} and the card stops working.`
                  : `The remaining ${formatINR(card.balancePaise)} is voided and the card stops working. Nothing is refunded (it was partly used, or it was complimentary).`
              }
              field={{ name: "reason", label: "Reason", placeholder: "e.g. bought by mistake" }}
              confirmLabel={card.status === "cancelled" ? "Retry refund" : "Cancel card"}
              tone="danger"
              variant="danger"
              action={cancelGiftCardAction.bind(null, card.id)}
              success="Gift card cancelled."
            />
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-bold text-admin-dark">Card</h2>
          <Fact label="Status">
            <StatusBadge status={card.status} />
          </Fact>
          <Fact label="Balance">
            {formatINR(card.balancePaise)} of {formatINR(card.amountPaise)}
          </Fact>
          <Fact label="Expires">{when(card.expiresAt)}</Fact>
          {card.designName ? <Fact label="Design">{card.designName}</Fact> : null}
          <Fact label="Recipient">
            {card.recipientName} · {card.recipientContact}
          </Fact>
          {card.message ? <Fact label="Message">&ldquo;{card.message}&rdquo;</Fact> : null}
          {card.cancelledAt ? (
            <Fact label="Cancelled">
              {when(card.cancelledAt)}
              {card.cancelReason ? `: ${card.cancelReason}` : ""}
            </Fact>
          ) : null}
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-bold text-admin-dark">{card.source === "complimentary" ? "Issued by" : "Buyer"}</h2>
          {card.source === "complimentary" ? (
            <>
              <Fact label="Staff member">{card.issuedByName ?? "Former staff"}</Fact>
              {card.issueReason ? <Fact label="Reason">{card.issueReason}</Fact> : null}
            </>
          ) : (
            <>
              <Fact label="Customer">
                {card.buyerId ? (
                  <Link href={`/customers/${card.buyerId}`} className="text-admin-indigo hover:underline">
                    {card.buyerName ?? "Customer"}
                  </Link>
                ) : (
                  "—"
                )}
              </Fact>
              <Fact label="Contact">{card.buyerContact ?? "—"}</Fact>
              <Fact label="Purchase">
                {card.purchaseBookingCode ? (
                  <Link href={`/bookings/${card.purchaseBookingCode}`} className="font-mono text-admin-indigo hover:underline">
                    {card.purchaseBookingCode}
                  </Link>
                ) : (
                  "—"
                )}
              </Fact>
            </>
          )}
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold text-admin-dark">Ledger</h2>
        <ol className="divide-y divide-slate-100 text-xs">
          {card.transactions.map((t, i) => (
            <li key={`${t.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold text-admin-dark">{ENTRY_LABELS[t.type]}</span>
                {t.bookingCode ? (
                  <>
                    {" · "}
                    <Link href={`/bookings/${t.bookingCode}`} className="font-mono text-admin-indigo hover:underline">
                      {t.bookingCode}
                    </Link>
                  </>
                ) : null}
                {t.staffName ? <span className="text-admin-subtle"> · by {t.staffName}</span> : null}
                <span className="block text-[10px] text-admin-subtle">{when(t.at)}</span>
              </span>
              <span className="font-mono font-bold">
                {t.type === "redeem" || t.type === "cancel" ? "−" : "+"}
                {formatINR(t.amountPaise)}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
