import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { PlanForm } from "@/components/billing/PlanForm";

export const metadata: Metadata = { title: "New plan" };

export default async function NewPlanPage() {
  const { staff } = await requireStaffPage("/plans/new");
  if (!hasPermission(staff.permissions, "plans:write")) return <NoAccess title="New plan" />;
  return (
    <>
      <PageHeader title="New plan" crumb="Subscription Plans" />
      <Card className="max-w-xl p-6">
        <PlanForm />
      </Card>
    </>
  );
}
