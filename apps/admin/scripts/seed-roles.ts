/**
 * Creates the platform system roles (Super Admin, Operations, Finance, Support, Marketing) and retires the
 * prototype's Cinema Manager / Event Manager (deleted when unused, else kept as custom roles). Idempotent.
 *   pnpm db:seed-roles
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/admin/.env.local if present).
 */
import { seedSystemRoles } from "@showbuzz/core/auth/admin/staff-account.service";
import { disconnect } from "@showbuzz/db/connect";
import { log } from "@showbuzz/runtime/log";

async function main() {
  const result = await seedSystemRoles();
  log.info("System roles seeded", { ...result });
}

main()
  .catch((err: unknown) => {
    log.error("Role seed failed", { err });
    process.exitCode = 1;
  })
  .finally(() => disconnect());
