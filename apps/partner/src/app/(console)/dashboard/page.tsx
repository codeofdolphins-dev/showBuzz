import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeIndianRupee, Building2, ChevronRight, Clock, Landmark, MapPin, RotateCcw, Ticket } from "lucide-react";
import { Card, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getPlanSummary } from "@showbuzz/core/services/partner/account.service";
import { VENDOR_BUSINESS_TYPE_LABELS, describeCutoff } from "@showbuzz/schemas/vendor";
import { formatINR } from "@showbuzz/utils/money";

export const metadata: Metadata = { title: "Dashboard" };

const percent = (bps: number) => `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

const QUICK_LINKS = [
  { href: "/venues", label: "Add your venues & screens", icon: MapPin },
  { href: "/shows", label: "Schedule shows", icon: Clock },
  { href: "/bookings", label: "See bookings", icon: Ticket },
  { href: "/business-profile", label: "Business profile", icon: Building2 },
];

/**
 * The vendor's home: name, account status and the money terms ShowBuzz applies to its sales. Sales figures arrive
 * with the partner dashboard in back-office prompt 8.
 */
export default async function DashboardPage() {
  const { vendorUser, vendor } = await requireVendorPage("/dashboard");
  const plan = vendor.billingModel === "subscription" ? await getPlanSummary(vendor.planId) : null;

  return (
    <>
      <PageHeader
        title={vendor.businessName}
        subtitle={`Welcome back, ${vendorUser.name.split(" ")[0]}. ${VENDOR_BUSINESS_TYPE_LABELS[vendor.businessType]} on ShowBuzz.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={vendor.status} />
            <StatusBadge tone={vendor.onboardingStatus === "complete" ? "success" : "warning"}>
              {vendor.onboardingStatus === "complete" ? "Onboarding complete" : "Onboarding incomplete"}
            </StatusBadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5">
          <CardTitle icon={BadgeIndianRupee} title="Billing" subtitle="Set by ShowBuzz for your account" />
          <dl className="space-y-2.5 text-xs">
            <Term label="Billing model">
              {vendor.billingModel === "commission" ? "Commission on sales" : "Monthly subscription"}
            </Term>
            {vendor.billingModel === "commission" ? (
              <Term label="Commission">{percent(vendor.commissionBps)} of ticket + food sales (after discounts)</Term>
            ) : (
              <Term label="Plan">
                {plan ? `${plan.name} · ${formatINR(plan.monthlyFeePaise)} / month` : "Plan to be assigned by ShowBuzz"}
              </Term>
            )}
            <Term label="Convenience fee">
              {percent(vendor.convenienceFeeBps)} charged to customers (kept by ShowBuzz)
            </Term>
            <Term label="GST on fee">{percent(vendor.gstBps)}</Term>
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <CardTitle icon={RotateCcw} title="Cancellation policy" subtitle="Shown to customers on your shows" />
          <dl className="space-y-2.5 text-xs">
            <Term label="Cancellations">{vendor.cancellation.allowed ? "Allowed" : "Not allowed"}</Term>
            {vendor.cancellation.allowed ? (
              <>
                <Term label="Cutoff">{describeCutoff(vendor.cancellation.cutoffMinutes)}</Term>
                <Term label="Fee">{formatINR(vendor.cancellation.feePaise)} per booking</Term>
              </>
            ) : null}
          </dl>
          <p className="text-[11px] text-admin-subtle">You&apos;ll be able to edit this from Cancellation Policy.</p>
        </Card>

        <Card className="space-y-4 p-5">
          <CardTitle icon={Landmark} title="KYC & payouts" subtitle="Verified during onboarding" />
          <dl className="space-y-2.5 text-xs">
            <Term label="GSTIN">
              <span className="font-mono">{vendor.kyc.gstin || "—"}</span>
            </Term>
            <Term label="PAN">
              <span className="font-mono">{vendor.kyc.pan || "—"}</span>
            </Term>
            <Term label="Payout account">
              <span className="font-mono">
                {vendor.kyc.bankAccount.accountNumberMasked || "—"} · {vendor.kyc.bankAccount.ifsc || "—"}
              </span>
            </Term>
          </dl>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-admin-border bg-slate-50/50 p-4">
          <h2 className="text-sm font-bold text-admin-dark">Get started</h2>
          <p className="text-[11px] text-admin-subtle">
            Your account is live. Venue, show and booking screens are being rolled out next.
          </p>
        </div>
        <ul className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 p-4 text-xs font-semibold text-admin-text hover:bg-admin-active hover:text-admin-indigo"
              >
                <Icon className="h-4 w-4 text-admin-indigo" aria-hidden />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-admin-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function CardTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof BadgeIndianRupee;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-admin-active text-admin-indigo">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h2 className="text-sm font-bold text-admin-dark">{title}</h2>
        <p className="text-[11px] text-admin-subtle">{subtitle}</p>
      </div>
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wide text-admin-subtle uppercase">{label}</dt>
      <dd className="font-semibold text-admin-dark">{children}</dd>
    </div>
  );
}
