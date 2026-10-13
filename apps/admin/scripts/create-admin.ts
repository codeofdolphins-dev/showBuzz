/**
 * Creates a Super Admin (the first staff account, or a break-glass one). Seeds the system roles first.
 *   pnpm db:create-admin --email you@showbuzz.com --name "Your Name"
 * The password is asked for without echoing it (never pass it as an argument: it would land in shell history).
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/admin/.env.local if present).
 */
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { ZodError } from "zod";
import { createStaff, superAdminRoleId } from "@showbuzz/core/auth/admin/staff-account.service";
import { AppError } from "@showbuzz/core/http/app-error";
import { disconnect } from "@showbuzz/db/connect";
import { newPasswordSchema, staffEmailSchema } from "@showbuzz/schemas/staff";
import { personNameSchema } from "@showbuzz/schemas/common";

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
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  const email = staffEmailSchema.parse(values.email ?? (await ask("Email: ")));
  const name = personNameSchema.parse(values.name ?? (await ask("Full name: ")));

  const password = await ask("Password (min 12 characters): ", { hidden: true });
  const parsed = newPasswordSchema.safeParse(password);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid password");
  if ((await ask("Repeat password: ", { hidden: true })) !== password) throw new Error("Passwords don't match");

  const roleId = await superAdminRoleId();
  const staff = await createStaff({ name, email, password, roleId });
  console.log(`Super Admin created: ${staff.email}. Sign in at the admin app's /login.`);
}

main()
  .catch((err: unknown) => {
    // Script output for the operator; never includes the password.
    if (err instanceof ZodError) console.error(`Error: ${err.issues[0]?.message ?? "invalid input"}`);
    else console.error(err instanceof AppError || err instanceof Error ? `Error: ${err.message}` : err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
