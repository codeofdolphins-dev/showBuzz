import "server-only";
import { PARTNER_AUTH } from "@showbuzz/schemas/constants";
import { VendorUser, type VendorUserDocument } from "@showbuzz/db/models/VendorUser";
import { createSessionStore } from "../session-store";
import { partnerTokens } from "./tokens";

/** Vendor-user sessions: `vendorUsers.sessions[]` with partner tokens; same rotation and reuse rules as staff. */
export const vendorUserSessions = createSessionStore<VendorUserDocument>({
  model: VendorUser,
  tokens: partnerTokens,
  maxSessions: PARTNER_AUTH.maxSessionsPerVendorUser,
  label: "vendor-user",
});
