import type { Metadata } from "next";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { Card, ComingSoon, NoAccess } from "@/components/console/PageParts";
import { ResetPasswordForm } from "@/components/users/ResetPasswordForm";

export const metadata: Metadata = { title: "Staff & Operators" };

/**
 * The staff list/editor comes with batch 6.10. Until then the page carries the Super Admin password reset,
 * the stand-in for email-based recovery (CLAUDE.md §12).
 */
export default async function UsersPage() {
  const { staff } = await requireStaffPage("/users");
  if (!hasPermission(staff.permissions, "users:read")) return <NoAccess title="Staff & Operators" />;

  return (
    <ComingSoon title="Staff & Operators">
      {hasPermission(staff.permissions, "users:reset-password") ? (
        <Card className="max-w-xl space-y-4 p-6">
          <div>
            <h2 className="text-sm font-bold text-admin-dark">Reset a staff password</h2>
            <p className="text-[11px] text-admin-subtle">
              Sets a temporary password and signs that person out everywhere. Share it privately; they should
              change it from their profile after signing in.
            </p>
          </div>
          <ResetPasswordForm />
        </Card>
      ) : null}
    </ComingSoon>
  );
}
