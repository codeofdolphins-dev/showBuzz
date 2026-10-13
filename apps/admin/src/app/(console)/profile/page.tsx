import type { Metadata } from "next";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { Card, PageHeader } from "@/components/console/PageParts";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { Input, Label } from "@/components/ui/form";

export const metadata: Metadata = { title: "My Profile" };

const dateTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Own details (read-only for now: a Super Admin edits staff records) and password change. */
export default async function ProfilePage() {
  const { staff } = await requireStaffPage("/profile");
  const initials = staff.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <PageHeader title="My Profile" crumb="My Profile" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-6 p-6">
          <div className="flex items-center gap-4 border-b border-admin-border pb-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-admin-indigo bg-admin-active text-lg font-black text-admin-indigo">
              {initials}
            </span>
            <div>
              <h2 className="text-base font-bold text-admin-dark">{staff.name}</h2>
              <p className="text-xs text-admin-muted">{staff.email}</p>
              <span className="mt-1 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                {staff.role.name}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="profile-name">Full Name</Label>
              <Input id="profile-name" readOnly value={staff.name} />
            </div>
            <div>
              <Label htmlFor="profile-email">Email Address</Label>
              <Input id="profile-email" readOnly value={staff.email} />
            </div>
            <div>
              <Label htmlFor="profile-role">Assigned Role</Label>
              <Input id="profile-role" readOnly value={staff.role.name} className="font-bold" />
            </div>
            <div>
              <Label htmlFor="profile-login">Last Sign-in</Label>
              <Input
                id="profile-login"
                readOnly
                value={staff.lastLoginAt ? dateTime.format(new Date(staff.lastLoginAt)) : "—"}
              />
            </div>
          </div>
          <p className="text-[11px] text-admin-subtle">To change your name or email, ask a Super Admin.</p>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-sm font-bold text-admin-dark">Change Password</h2>
            <p className="text-[11px] text-admin-subtle">
              At least 12 characters. Your other devices are signed out after the change.
            </p>
          </div>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
