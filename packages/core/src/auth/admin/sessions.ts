import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { Staff, type StaffDocument } from "@showbuzz/db/models/Staff";
import { createSessionStore } from "../session-store";
import { adminTokens } from "./tokens";

/** Staff sessions: `staff.sessions[]` with staff tokens; same rotation and reuse rules as customers. */
export const staffSessions = createSessionStore<StaffDocument>({
  model: Staff,
  tokens: adminTokens,
  maxSessions: ADMIN_AUTH.maxSessionsPerStaff,
  label: "staff",
});
