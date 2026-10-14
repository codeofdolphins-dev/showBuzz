import type { CurrentVendor } from "@showbuzz/core/auth/partner/vendor-auth.service";

/** The activity-log actor for the signed-in vendor login. */
export const actorOf = ({ vendorUser, vendor }: CurrentVendor) => ({
  type: "vendor" as const,
  id: vendorUser.id,
  vendorId: vendor.id,
});
