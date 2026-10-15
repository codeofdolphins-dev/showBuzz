import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { RoleForm } from "@/components/users/RoleForm";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage() {
  const { staff } = await requireStaffPage("/roles/new");
  if (!hasPermission(staff.permissions, "roles:write")) return <NoAccess title="New role" />;
  return (
    <>
      <PageHeader title="New role" crumb="Role Permissions" subtitle="Tick what this role may view and manage." />
      <Card className="p-6">
        <RoleForm grantable={staff.permissions} />
      </Card>
    </>
  );
}
