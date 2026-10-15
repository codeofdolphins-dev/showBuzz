import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getRole } from "@showbuzz/core/services/admin/staff-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { deleteRoleAction } from "@/app/_actions/staff";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { RoleForm } from "@/components/users/RoleForm";

export const metadata: Metadata = { title: "Role" };

/** One role's permission matrix. Super Admin is read-only; custom roles nobody uses can be deleted. */
export default async function RolePage({ params }: PageProps<"/roles/[roleId]">) {
  const { roleId } = await params;
  const { staff } = await requireStaffPage(`/roles/${roleId}`);
  if (!hasPermission(staff.permissions, "roles:read")) return <NoAccess title="Role" />;
  const role = await getRole(roleId);
  if (!role) notFound();
  const canWrite = hasPermission(staff.permissions, "roles:write");

  return (
    <>
      <PageHeader
        title={role.name}
        crumb="Role Permissions"
        subtitle={`${role.staff} staff member(s) · ${role.locked ? "always has every permission" : role.isSystem ? "system role" : "custom role"}`}
        actions={
          canWrite && !role.isSystem ? (
            <PromptActionButton
              label="Delete role"
              title={`Delete ${role.name}?`}
              description={
                role.staff > 0
                  ? "Staff still have this role: move them to another role first."
                  : "This can't be undone."
              }
              confirmLabel="Delete"
              tone="danger"
              variant="danger"
              action={deleteRoleAction.bind(null, role.id)}
              success="Role deleted."
              redirectTo="/roles"
            />
          ) : null
        }
      />
      <Card className="p-6">
        <RoleForm
          roleId={role.id}
          defaults={{ name: role.name, description: role.description, permissions: role.permissions }}
          nameLocked={role.isSystem}
          readOnly={role.locked || !canWrite}
          grantable={staff.permissions}
        />
      </Card>
    </>
  );
}
