import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listRoleOptions } from "@showbuzz/core/services/admin/staff-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { CreateStaffForm } from "@/components/users/StaffForm";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const { staff } = await requireStaffPage("/users/new");
  if (!hasPermission(staff.permissions, "users:write")) return <NoAccess title="Add staff" />;
  const roles = await listRoleOptions({ staffId: staff.id, permissions: staff.permissions });
  return (
    <>
      <PageHeader
        title="Add staff member"
        crumb="Staff & Operators"
        subtitle="A temporary password is generated and shown once (no email provider yet). You can only give roles whose permissions you have."
      />
      <Card className="max-w-xl p-6">
        <CreateStaffForm roles={roles} />
      </Card>
    </>
  );
}
