import type { Metadata } from "next";
import { Button, Input, Label, Select } from "@showbuzz/console-ui/form";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { defaultPayoutRange, previewSettlement } from "@showbuzz/core/services/admin/settlement.service";
import { listVendorOptions } from "@showbuzz/core/services/admin/shared";
import { connect } from "@showbuzz/db/connect";
import { settlementRangeSchema } from "@showbuzz/schemas/admin-marketplace";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CreateSettlementButton } from "@/components/billing/CreateSettlementButton";
import { SettlementLinesTable, SettlementSummary } from "@/components/billing/SettlementLines";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Run payout" };

/**
 * Pick a vendor and a period (a plain GET form, so the preview is server-rendered from the URL), check the bookings
 * and totals, then create the payout. Only shows that have already started are counted.
 */
export default async function NewSettlementPage({ searchParams }: PageProps<"/settlements/new">) {
  const { staff } = await requireStaffPage("/settlements/new");
  if (!hasPermission(staff.permissions, "settlements:write")) return <NoAccess title="Run payout" />;
  const sp = await searchParams;
  const now = new Date();
  const defaults = defaultPayoutRange(now);
  const vendorId = param(sp, "vendor") ?? "";
  const fromDate = param(sp, "from") || defaults.fromDate;
  const toDate = param(sp, "to") || defaults.toDate;
  await connect();
  const vendors = await listVendorOptions({ onboardingStatus: "complete" });
  const range = settlementRangeSchema.safeParse({ vendorId, fromDate, toDate });
  const preview = range.success ? await load(() => previewSettlement(range.data, now)) : null;

  return (
    <>
      <PageHeader
        title="Run payout"
        crumb="Vendor Payouts"
        subtitle="Bookings are counted by show date (purchase date for undated passes), for shows that have already started and aren't in an earlier payout."
      />
      <Card className="p-5">
        <form method="get" className="grid grid-cols-1 items-end gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="vendor" required>
              Vendor
            </Label>
            <Select id="vendor" name="vendor" defaultValue={vendorId} required>
              <option value="">Choose a vendor</option>
              {vendors.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from" required>
              From
            </Label>
            <Input id="from" name="from" type="date" defaultValue={fromDate} required />
          </div>
          <div>
            <Label htmlFor="to" required>
              To
            </Label>
            <Input id="to" name="to" type="date" defaultValue={toDate} required />
          </div>
          <div className="sm:col-span-4 sm:text-right">
            <Button type="submit" variant="secondary">
              Preview payout
            </Button>
          </div>
        </form>
        {vendorId && !range.success ? (
          <p role="alert" className="mt-3 text-xs font-medium text-admin-danger">
            {range.error.issues[0]?.message ?? "Check the vendor and dates."}
          </p>
        ) : null}
      </Card>

      {preview && !preview.ok ? <TableError message="The preview couldn't be calculated." /> : null}
      {preview?.ok ? (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
            <SettlementSummary totals={preview.data.totals} />
            <Card className="space-y-3 p-5">
              <h3 className="text-sm font-bold text-admin-dark">{preview.data.vendorName}</h3>
              <p className="text-xs text-admin-muted">
                {preview.data.billingModel === "commission"
                  ? "Commission vendor: ShowBuzz keeps its commission on every sale."
                  : "Subscription vendor: no commission; it pays the monthly plan invoice instead."}
              </p>
              {preview.data.totals.bookings + preview.data.totals.clawbacks > 0 ? (
                <CreateSettlementButton
                  range={{
                    vendorId: preview.data.vendorId,
                    fromDate: preview.data.fromDate,
                    toDate: preview.data.toDate,
                  }}
                  expected={{
                    bookings: preview.data.totals.bookings,
                    clawbacks: preview.data.totals.clawbacks,
                    netPayoutPaise: preview.data.totals.netPayoutPaise,
                  }}
                />
              ) : (
                <p className="text-xs font-semibold text-admin-dark">Nothing to pay out for this period.</p>
              )}
            </Card>
          </div>
          {preview.data.truncated ? (
            <p className="text-[11px] text-admin-muted">
              Showing the first bookings only; the totals include all of them.
            </p>
          ) : null}
          <SettlementLinesTable title="Bookings in this payout" lines={preview.data.lines} />
          <SettlementLinesTable title="Cancellation adjustments" lines={preview.data.clawbackLines} />
        </>
      ) : null}
    </>
  );
}
