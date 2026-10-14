/**
 * Creates the owner login for an existing vendor (one per vendor for now).
 *   pnpm db:create-vendor-user --vendor kolkata-screens --email owner@business.com --name "Owner Name"
 * The password is asked for without echoing it (never pass it as an argument: it would land in shell history).
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/partner/.env.local if present).
 */
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { ZodError } from "zod";
import { createVendorUser } from "@showbuzz/core/auth/partner/vendor-user-account.service";
import { AppError } from "@showbuzz/core/http/app-error";
import { disconnect } from "@showbuzz/db/connect";

function ask(question: string, { hidden = false } = {}): Promise<string> {
  let muted = false;
  // Echo the prompt, then swallow what the user types when hidden.
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = hidden;
  });
}

async function main() {
  const { values } = parseArgs({
    options: { vendor: { type: "string" }, email: { type: "string" }, name: { type: "string" } },
  });
  const vendorSlug = values.vendor ?? (await ask("Vendor slug: "));
  const email = values.email ?? (await ask("Email: "));
  const name = values.name ?? (await ask("Full name: "));

  const password = await ask("Password (min 12 characters): ", { hidden: true });
  if ((await ask("Repeat password: ", { hidden: true })) !== password) throw new Error("Passwords don't match");

  const user = await createVendorUser({ vendorSlug, email, name, password });
  console.log(`Partner login created for ${user.vendor}: ${user.email}. Sign in at the partner app's /login.`);
}

main()
  .catch((err: unknown) => {
    // Script output for the operator; never includes the password.
    if (err instanceof ZodError) console.error(`Error: ${err.issues[0]?.message ?? "invalid input"}`);
    else console.error(err instanceof AppError || err instanceof Error ? `Error: ${err.message}` : err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
