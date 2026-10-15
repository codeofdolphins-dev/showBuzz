import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Gift } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { GIFT_CARD_SORT_FIELDS, listGiftCardsAdmin } from "@showbuzz/core/services/admin/gift-card-admin.service";
import { giftCardSourceSchema, giftCardStatusFilterSchema } from "@showbuzz/schemas/admin-platform";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { GiftCardRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Gift Cards" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "redeemed", label: "Used up" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];
const SOURCE_OPTIONS = [
  { value: "purchase", label: "Bought online" },
  { value: "complimentary", label: "Complimentary" },
];

const COLUMNS: DataTableColumn<GiftCardRow>[] = [
  {
    key: "code",
    header: "Voucher code",
    cell: (g) => (
      <span>
        <Link href={`/gift-cards/${g.id}`} className="font-mono font-bold text-admin-dark hover:text-admin-indigo">
          {g.code}
        </Link>
        <span className="block text-[10px] text-admin-subtle">
          {g.source === "complimentary" ? "Complimentary" : `Bought by ${g.buyerName ?? "a customer"}`}
        </span>
      </span>
    ),
  },
  { key: "recipient", header: "Recipient", cell: (g) => g.recipientName },
  {
    key: "balance",
    header: "Card balance",
    sortField: "balancePaise",
    className: "text-right",
    cell: (g) => (
      <span>
        <span className="block font-mono font-bold">{formatINR(g.balancePaise)}</span>
        <span className="block text-[10px] text-admin-subtle">of {formatINR(g.amountPaise)}</span>
      </span>
    ),
  },
  { key: "issued", header: "Issued", sortField: "createdAt", cell: (g) => formatDateShort(new Date(g.createdAt)) },
  { key: "expires", header: "Expires", sortField: "expiresAt", cell: (g) => formatDateShort(new Date(g.expiresAt)) },
  { key: "status", header: "Status", cell: (g) => <StatusBadge status={g.status === "redeemed" ? "completed" : g.status}>{g.status === "redeemed" ? "Used up" : undefined}</StatusBadge> },
];

/** Prototype gift-cards.html: every ShowBuzz gift card, bought online or issued by staff. */
export default async function GiftCardsPage({ searchParams }: PageProps<"/gift-cards">) {
  const { staff } = await requireStaffPage("/gift-cards");
  if (!hasPermission(staff.permissions, "gift-cards:read")) return <NoAccess title="Gift Cards" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: GIFT_CARD_SORT_FIELDS,
    defaultSort: { field: "createdAt", direction: "desc" },
  });
  const result = await load(() =>
    listGiftCardsAdmin(
      {
        ...params,
        ...defined({
          status: enumParam(sp, "status", giftCardStatusFilterSchema),
          source: enumParam(sp, "source", giftCardSourceSchema),
        }),
      },
      new Date(),
    ),
  );

  return (
    <>
      <PageHeader
        title="Digital Entertainment Gift Cards"
        crumb="Gift Cards"
        subtitle="Cards are valid 12 months. No delivery provider yet: buyers and staff pass codes on themselves."
        actions={
          hasPermission(staff.permissions, "gift-cards:issue") ? (
            <LinkButton href="/gift-cards/new">
              <Gift className="h-4 w-4" aria-hidden /> Issue complimentary card
            </LinkButton>
          ) : null
        }
      />
      <FilterBar
        searchPlaceholder="Code (or last 4), recipient name or contact…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "source", label: "Source", options: SOURCE_OPTIONS },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(g) => g.id}
          total={result.data.total}
          params={params}
          pathname="/gift-cards"
          searchParams={sp}
          caption="Gift cards"
          rowActions={(g) => (
            <Link
              href={`/gift-cards/${g.id}`}
              className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
              aria-label={`Open ${g.code}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </Link>
          )}
          empty={<EmptyState title="No gift cards match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
