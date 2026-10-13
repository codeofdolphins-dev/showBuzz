/**
 * Creates the five system roles from the prototype matrix (Super Admin, Cinema Manager, Event Manager, Finance,
 * Support). Idempotent: run it as often as you like.
 *   pnpm db:seed-roles
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/admin/.env.local if present).
 */
import { seedSystemRoles } from "@showbuzz/core/auth/admin/staff-account.service";
import { disconnect } from "@showbuzz/db/connect";
import { log } from "@showbuzz/runtime/log";

async function main() {
  const { created, synced } = await seedSystemRoles();
  log.info("System roles seeded", { created, synced });
}

main()
  .catch((err: unknown) => {
    log.error("Role seed failed", { err });
    process.exitCode = 1;
  })
  .finally(() => disconnect());
