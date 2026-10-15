import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getStaffDetail, listRoleOptions } from "@showbuzz/core/services/admin/staff-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { setStaffStatusAction } from "@/app/_actions/staff";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { EditStaffForm } from "@/components/users/StaffForm";
import { StaffPasswordReset } from "@/components/users/StaffPasswordReset";

export const metadata: Metadata = { title: "Staff member" };

const when = (iso?: string) => (iso ? `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}` : "Never");

/** One staff account: details, role, disable / enable and the temporary password stand-in. */
export default async function StaffPage({ params }: PageProps<"/users/[staffId]">) {
  const { staffId } = await params;
  const { staff } = await requireStaffPage(`/users/${staffId}`);
  if (!hasPermission(staff.permissions, "users:read")) return <NoAccess title="Staff member" />;
  const now = new Date();
  const [member, roles] = await Promise.all([
    getStaffDetail(staffId, staff.id, now),
    listRoleOptions({ staffId: staff.id, permissions: staff.permissions }),
  ]);
  if (!member) notFound();
  const canWrite = hasPermission(staff.permissions, "users:write");
  const disabled = member.status === "disabled";

  return (
    <>
      <PageHeader title={member.name} crumb="Staff & Operators" subtitle={member.email} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-4 p-6">
          <h2 className="text-sm font-bold text-admin-dark">Account</h2>
          {canWrite ? (
            <EditStaffForm
              staffId={member.id}
              defaults={{ name: member.name, roleId: member.roleId }}
              roles={roles}
              isSelf={member.isSelf}
            />
          ) : (
            <p className="text-xs text-admin-muted">
              {member.name} · <StatusBadge tone="indigo">{member.roleName}</StatusBadge>
            </p>
          )}
        </Card>
        <div className="space-y-5">
          <Card className="space-y-3 p-5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-admin-muted">Status</span>
              <StatusBadge status={member.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-muted">Role</span>
              {hasPermission(staff.permissions, "roles:read") ? (
                <Link href={`/roles/${member.roleId}`} className="font-semibold text-admin-indigo hover:underline">
                  {member.roleName}
                </Link>
              ) : (
                <span className="font-semibold">{member.roleName}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-muted">Last sign-in</span>
              <span className="font-semibold">{when(member.lastLoginAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-muted">Signed-in devices</span>
              <span className="font-semibold">{member.activeSessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-admin-muted">Created</span>
              <span className="font-semibold">{when(member.createdAt)}</span>
            </div>
            {canWrite && !member.isSelf ? (
              <div className="border-t border-admin-border pt-3">
                {member.isLastSuperAdmin && !disabled ? (
                  <p className="text-[11px] text-admin-subtle">
                    This is the last active Super Admin, so it can&apos;t be disabled.
                  </p>
                ) : (
                  <PromptActionButton
                    label={disabled ? "Enable account" : "Disable account"}
                    title={disabled ? `Enable ${member.name}?` : `Disable ${member.name}?`}
                    description={
                      disabled
                        ? "They can sign in again with their current password."
                        : "They are signed out on every device and can't sign in until enabled again."
                    }
                    confirmLabel={disabled ? "Enable" : "Disable"}
                    tone={disabled ? "primary" : "danger"}
                    variant={disabled ? "secondary" : "danger"}
                    action={setStaffStatusAction.bind(null, member.id, { status: disabled ? "active" : "disabled" })}
                    success={disabled ? "Account enabled." : "Account disabled."}
                  />
                )}
              </div>
            ) : null}
          </Card>
          {hasPermission(staff.permissions, "users:reset-password") && !member.isSelf ? (
            <Card className="space-y-3 p-5">
              <h2 className="text-sm font-bold text-admin-dark">Password</h2>
              <StaffPasswordReset email={member.email} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
