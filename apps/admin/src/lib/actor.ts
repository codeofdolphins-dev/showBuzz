import type { CurrentStaff } from "@showbuzz/core/auth/admin/staff-auth.service";

/** The activity-log actor for the signed-in staff member, with the vendor whose record changed (if any). */
export const actorOf = ({ staff }: CurrentStaff, vendorId?: string) => ({
  type: "staff" as const,
  id: staff.id,
  ...(vendorId ? { vendorId } : {}),
});
