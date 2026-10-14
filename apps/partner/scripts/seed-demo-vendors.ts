/**
 * Development shortcut (agreed 2026-10-14, like db:seed-demo-admin): one owner login per demo vendor from db:seed.
 *   pnpm db:seed-demo-vendors
 * Password 12345678 for all three. Idempotent: re-running resets the passwords and re-activates the logins.
 * Refuses to run in production. Run `pnpm db:seed` first (it creates the vendors).
 */
import { hashPassword } from "@showbuzz/core/auth/password";
import { connect, disconnect } from "@showbuzz/db/connect";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { isProduction } from "@showbuzz/runtime/env";

const DEMO_PASSWORD = "12345678";

export const DEMO_VENDOR_LOGINS = [
  { vendorSlug: "kolkata-screens", name: "Arindam Sen", email: "screens@showbuzz.test" },
  { vendorSlug: "bengal-picture-palace", name: "Moumita Ghosh", email: "palace@showbuzz.test" },
  { vendorSlug: "festive-nights", name: "Rahul Agarwal", email: "events@showbuzz.test" },
] as const;

async function main() {
  if (isProduction) throw new Error("Demo vendor logins are for development only; use pnpm db:create-vendor-user.");
  await connect();
  // Set directly: the demo password is below the 12-character policy on purpose.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const login of DEMO_VENDOR_LOGINS) {
    const vendor = await Vendor.findOne({ slug: login.vendorSlug }, { _id: 1, businessName: 1 }).lean();
    if (!vendor) {
      console.warn(`Skipped ${login.email}: vendor "${login.vendorSlug}" not found (run pnpm db:seed first).`);
      continue;
    }
    await VendorUser.updateOne(
      { email: login.email },
      {
        $set: {
          vendorId: vendor._id,
          name: login.name,
          role: "owner",
          status: "active",
          passwordHash,
          passwordChangedAt: new Date(),
        },
        $setOnInsert: { email: login.email, sessions: [] },
      },
      { upsert: true },
    );
    console.log(`Demo partner login ready: ${login.email} / ${DEMO_PASSWORD} (${vendor.businessName})`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? `Error: ${err.message}` : err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
