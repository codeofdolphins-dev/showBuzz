import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getPlan } from "@showbuzz/core/services/admin/plan.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { PlanForm } from "@/components/billing/PlanForm";

export const metadata: Metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params }: PageProps<"/plans/[planId]/edit">) {
  const { planId } = await params;
  const { staff } = await requireStaffPage(`/plans/${planId}/edit`);
  if (!hasPermission(staff.permissions, "plans:write")) return <NoAccess title="Edit plan" />;
  const plan = await getPlan(planId);
  if (!plan) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${plan.name}`}
        crumb="Subscription Plans"
        subtitle={`${plan.vendors} vendor(s) on this plan.`}
      />
      <Card className="max-w-xl p-6">
        <PlanForm
          planId={plan.id}
          defaults={{ name: plan.name, monthlyFeePaise: plan.monthlyFeePaise, active: plan.active }}
        />
      </Card>
    </>
  );
}
