/**
 * Development shortcut (agreed 2026-10-13): a fixed Super Admin for local/demo use.
 *   pnpm db:seed-demo-admin
 * Email admin@showbuzz.test, password 12345678. Idempotent: re-running resets the password and re-activates the
 * account. Refuses to run in production. Seeds the system roles first.
 */
import { hashPassword } from "@showbuzz/core/auth/admin/password";
import { superAdminRoleId } from "@showbuzz/core/auth/admin/staff-account.service";
import { connect, disconnect } from "@showbuzz/db/connect";
import { Staff } from "@showbuzz/db/models/Staff";
import { isProduction } from "@showbuzz/runtime/env";

export const DEMO_ADMIN = { name: "Demo Super Admin", email: "admin@showbuzz.test", password: "12345678" } as const;

async function main() {
  if (isProduction) throw new Error("The demo admin is for development only; use pnpm db:create-admin in production.");
  const roleId = await superAdminRoleId();
  await connect();
  // Set directly: the demo password is below the 12-character policy on purpose.
  await Staff.updateOne(
    { email: DEMO_ADMIN.email },
    {
      $set: {
        name: DEMO_ADMIN.name,
        roleId,
        status: "active",
        passwordHash: await hashPassword(DEMO_ADMIN.password),
        passwordChangedAt: new Date(),
      },
      $setOnInsert: { email: DEMO_ADMIN.email, sessions: [] },
    },
    { upsert: true },
  );
  console.log(`Demo Super Admin ready: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password} (development only)`);
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? `Error: ${err.message}` : err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
