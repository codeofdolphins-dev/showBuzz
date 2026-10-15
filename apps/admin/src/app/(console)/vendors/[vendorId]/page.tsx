import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Wallet } from "lucide-react";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param } from "@showbuzz/console-ui/search-params";
import { OnboardingWizard } from "@showbuzz/console-ui/vendor-kyc/OnboardingWizard";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listPlanOptions } from "@showbuzz/core/services/admin/plan.service";
import { getVendorAdminDetail } from "@showbuzz/core/services/admin/vendor-admin.service";
import { getOnboardingState, listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { bpsToPercent } from "@showbuzz/schemas/admin-marketplace";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { AdminVendorDetail, SalesSummary } from "@showbuzz/schemas/types/admin-marketplace";
import { KYC_DOCUMENT_LABELS, VENDOR_BUSINESS_TYPE_LABELS, describeCutoff } from "@showbuzz/schemas/vendor";
import { cn } from "@showbuzz/utils/cn";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { reactivateVendorAction, suspendVendorAction } from "@/app/_actions/vendors";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { AdminKycActions } from "@/components/vendors/AdminKycActions";
import { ResetVendorPassword } from "@/components/vendors/ResetVendorPassword";
import { VendorTermsForm } from "@/components/vendors/VendorTermsForm";

export const metadata: Metadata = { title: "Vendor" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "kyc", label: "KYC & documents" },
  { id: "onboarding", label: "Onboarding" },
  { id: "settings", label: "Billing & settings" },
  { id: "login", label: "Partner login" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** One vendor (prototype organiser-details.html): profile, KYC, onboarding on its behalf, terms, status, login. */
export default async function VendorDetailPage({ params, searchParams }: PageProps<"/vendors/[vendorId]">) {
  const { vendorId } = await params;
  const path = `/vendors/${vendorId}`;
  const { staff } = await requireStaffPage(path);
  if (!hasPermission(staff.permissions, "organisers:read")) return <NoAccess title="Vendor" />;
  const now = new Date();
  const detail = await getVendorAdminDetail(vendorId, now).catch(() => null);
  if (!detail) notFound();

  const { vendor } = detail;
  const incomplete = vendor.onboardingStatus === "incomplete";
  const requested = param(await searchParams, "tab");
  const tabs = TABS.filter((t) => t.id !== "onboarding" || incomplete);
  const tab: TabId = tabs.find((t) => t.id === requested)?.id ?? "overview";
  const canWrite = hasPermission(staff.permissions, "organisers:write");

  return (
    <>
      <PageHeader
        title={vendor.businessName}
        subtitle={`${VENDOR_BUSINESS_TYPE_LABELS[vendor.businessType]} · ${detail.cityName} · since ${formatDateShort(new Date(vendor.createdAt))}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={vendor.status} />
            {incomplete ? <StatusBadge tone="warning">Onboarding incomplete</StatusBadge> : null}
            {canWrite && vendor.status === "active" ? (
              <PromptActionButton
                label="Suspend"
                variant="danger"
                tone="danger"
                title={`Suspend ${vendor.businessName}?`}
                description="Its cinemas, events and offers disappear from showbuzz.com and its shows can't be booked. Sold tickets stay valid. The vendor can still sign in but can't change listings."
                field={{ name: "reason", label: "Reason (staff only)", placeholder: "e.g. Subscription unpaid" }}
                confirmLabel="Suspend vendor"
                action={suspendVendorAction.bind(null, vendor.id)}
                success={`${vendor.businessName} is suspended.`}
              />
            ) : null}
            {canWrite && vendor.status === "suspended" ? (
              <PromptActionButton
                label="Reactivate"
                variant="primary"
                title={`Reactivate ${vendor.businessName}?`}
                description="Its listings return to showbuzz.com (if onboarding is complete) and its shows can be booked again."
                confirmLabel="Reactivate"
                action={reactivateVendorAction.bind(null, vendor.id)}
                success={`${vendor.businessName} is active again.`}
              />
            ) : null}
          </div>
        }
      />
      {detail.suspendedAt ? (
        <p role="status" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-admin-danger">
          Suspended on {formatDateShort(new Date(detail.suspendedAt))}
          {detail.suspendReason ? `: ${detail.suspendReason}` : ""}.
        </p>
      ) : null}

      <nav aria-label="Vendor sections" className="flex gap-1 overflow-x-auto border-b border-admin-border">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "overview" ? path : `${path}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-bold whitespace-nowrap",
              tab === t.id
                ? "border-admin-indigo text-admin-indigo"
                : "border-transparent text-admin-muted hover:text-admin-dark",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <Overview detail={detail} canPayout={hasPermission(staff.permissions, "settlements:write")} />
      ) : null}
      {tab === "kyc" ? <Kyc detail={detail} /> : null}
      {tab === "onboarding" ? <Onboarding vendorId={vendor.id} canWrite={canWrite} /> : null}
      {tab === "settings" ? <Settings detail={detail} canWrite={canWrite} /> : null}
      {tab === "login" ? (
        <Login detail={detail} canReset={hasPermission(staff.permissions, "organisers:reset-password")} />
      ) : null}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}

function SalesCard({ title, sales }: { title: string; sales: SalesSummary }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-bold text-admin-dark">{title}</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Bookings">{sales.bookings.toLocaleString("en-IN")}</Fact>
        <Fact label="Tickets">{sales.tickets.toLocaleString("en-IN")}</Fact>
        <Fact label="Sales">{formatINR(sales.salesPaise)}</Fact>
        <Fact label="Commission">{formatINR(sales.commissionPaise)}</Fact>
        <Fact label="Vendor share">{formatINR(sales.vendorSharePaise)}</Fact>
        <Fact label="Refunded">{formatINR(sales.refundsPaise)}</Fact>
      </dl>
    </Card>
  );
}

function Overview({ detail, canPayout }: { detail: AdminVendorDetail; canPayout: boolean }) {
  const { vendor, counts } = detail;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-admin-dark">Business & commission profile</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact label="Contact">
              {vendor.contact.name}
              <span className="block font-normal text-admin-muted">
                {vendor.contact.phone} · {vendor.contact.email}
              </span>
            </Fact>
            <Fact label="Address">
              {[vendor.address.line, detail.cityName, vendor.address.pincode].filter(Boolean).join(", ") || "—"}
            </Fact>
            <Fact label="GSTIN">{vendor.kyc.gstin || "—"}</Fact>
            <Fact label="PAN">{vendor.kyc.pan || "—"}</Fact>
            <Fact label="Billing">
              {vendor.billingModel === "commission"
                ? `${bpsToPercent(vendor.commissionBps)}% commission`
                : detail.plan
                  ? `${detail.plan.name} · ${formatINR(detail.plan.monthlyFeePaise)}/mo`
                  : "Subscription · no plan set"}
            </Fact>
            <Fact label="Fees">
              {bpsToPercent(vendor.convenienceFeeBps)}% convenience fee + {bpsToPercent(vendor.gstBps)}% GST
            </Fact>
            <Fact label="Cancellation">
              {vendor.cancellation.allowed
                ? `${describeCutoff(vendor.cancellation.cutoffMinutes)}, fee ${formatINR(vendor.cancellation.feePaise)}`
                : "Not allowed"}
            </Fact>
            <Fact label="Customer contact">{vendor.shareCustomerContact ? "Shared" : "Hidden"}</Fact>
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-admin-dark">Listings</h3>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Venues">{counts.venues}</Fact>
            <Fact label="Events, plays, sports, activities">{counts.events}</Fact>
            <Fact label="Upcoming shows">{counts.upcomingShows}</Fact>
            <Fact label="Films added to catalogue">{counts.moviesCreated}</Fact>
          </dl>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SalesCard title="Sales, all time" sales={detail.sales.allTime} />
        <SalesCard title="Sales, last 30 days" sales={detail.sales.last30Days} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-admin-dark">Recent payouts</h3>
            {canPayout ? (
              <LinkButton href={`/settlements/new?vendor=${vendor.id}`} variant="secondary">
                <Wallet className="h-4 w-4" aria-hidden /> Run payout
              </LinkButton>
            ) : null}
          </div>
          {detail.payouts.length === 0 ? (
            <p className="text-xs text-admin-muted">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {detail.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/settlements/${p.id}`} className="font-mono font-bold text-admin-indigo hover:underline">
                    {p.code}
                  </Link>
                  <span className="text-admin-muted">
                    {formatDateShort(new Date(p.periodFrom))} – {p.periodToKey}
                  </span>
                  <span className="font-mono font-bold">{formatINR(p.netPayoutPaise)}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-bold text-admin-dark">Subscription invoices</h3>
          {detail.invoices.length === 0 ? (
            <p className="text-xs text-admin-muted">
              {vendor.billingModel === "subscription" ? "No invoices yet." : "Commission vendor: no invoices."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {detail.invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-mono font-bold">{i.code}</span>
                  <span className="text-admin-muted">{i.month}</span>
                  <span className="font-mono">{formatINR(i.amountPaise)}</span>
                  <StatusBadge status={i.overdue ? "overdue" : i.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kyc({ detail }: { detail: AdminVendorDetail }) {
  const { kyc, vendor } = detail;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold text-admin-dark">Tax & payout bank account</h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact label="GSTIN">
            <span className="font-mono">{kyc.gstin || "—"}</span>
          </Fact>
          <Fact label="PAN">
            <span className="font-mono">{kyc.pan || "—"}</span>
          </Fact>
          <Fact label="Account holder">{kyc.bankAccount.holderName || "—"}</Fact>
          <Fact label="Account number">
            <span className="font-mono">{kyc.bankAccount.accountNumber || "—"}</span>
          </Fact>
          <Fact label="IFSC">
            <span className="font-mono">{kyc.bankAccount.ifsc || "—"}</span>
          </Fact>
          <Fact label="Onboarding">{vendor.onboardingStatus === "complete" ? "Complete" : "Incomplete"}</Fact>
        </dl>
        <p className="mt-4 text-[11px] text-admin-subtle">
          The vendor edits these from Business Profile; every bank change is in the activity log.
        </p>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold text-admin-dark">Documents</h3>
        {kyc.documents.length === 0 ? (
          <p className="text-xs text-admin-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {kyc.documents.map((d) => (
              <li key={d.fileId} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-admin-subtle" aria-hidden />
                  <span>
                    <span className="block font-bold text-admin-dark">{KYC_DOCUMENT_LABELS[d.kind]}</span>
                    <span className="block text-[11px] text-admin-subtle">
                      {d.filename} · {(d.size / 1024).toFixed(0)} KB · {formatDateShort(new Date(d.uploadedAt))}
                    </span>
                  </span>
                </span>
                <a
                  href={`/api/v1/admin/vendors/${vendor.id}/documents/${d.fileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-admin-indigo hover:underline"
                >
                  View <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function Onboarding({ vendorId, canWrite }: { vendorId: string; canWrite: boolean }) {
  if (!canWrite) {
    return <p className="text-xs text-admin-muted">Your role can view vendors but not fill in their KYC.</p>;
  }
  const state = await getOnboardingState(vendorId);
  const cities = await listCityOptions(state.vendor.address.cityId);
  return (
    <>
      <p className="text-xs text-admin-muted">
        Fill in the vendor&apos;s KYC on its behalf (the same steps and checks as the partner portal). The vendor can
        also finish them after signing in. Listings go live once onboarding is complete.
      </p>
      <AdminKycActions vendorId={vendorId}>
        <OnboardingWizard state={state} cities={cities} />
      </AdminKycActions>
    </>
  );
}

async function Settings({ detail, canWrite }: { detail: AdminVendorDetail; canWrite: boolean }) {
  const { vendor } = detail;
  const plans = await listPlanOptions(vendor.planId);
  return (
    <Card className="max-w-3xl p-6">
      <VendorTermsForm
        vendorId={vendor.id}
        canWrite={canWrite}
        plans={plans}
        defaults={{
          billingModel: vendor.billingModel,
          planId: vendor.planId ?? "",
          commissionPercent: bpsToPercent(vendor.commissionBps),
          convenienceFeePercent: bpsToPercent(vendor.convenienceFeeBps),
          gstPercent: bpsToPercent(vendor.gstBps),
          shareCustomerContact: vendor.shareCustomerContact,
        }}
      />
    </Card>
  );
}

function Login({ detail, canReset }: { detail: AdminVendorDetail; canReset: boolean }) {
  const { login } = detail;
  if (!login) return <p className="text-xs text-admin-muted">This vendor has no partner login.</p>;
  return (
    <Card className="max-w-xl space-y-4 p-6">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact label="Name">{login.name}</Fact>
        <Fact label="Email">{login.email}</Fact>
        <Fact label="Status">
          <StatusBadge status={login.status} />
        </Fact>
        <Fact label="Last sign-in">{login.lastLoginAt ? formatDateShort(new Date(login.lastLoginAt)) : "Never"}</Fact>
      </dl>
      {canReset ? <ResetVendorPassword vendorId={detail.vendor.id} email={login.email} /> : null}
    </Card>
  );
}
