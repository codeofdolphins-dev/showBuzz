/**
 * Starts the app for Playwright against a throwaway in-memory MongoDB replica set (never a real database).
 * Playwright's webServer runs this; the database must exist before Next boots, so it is started here rather
 * than in a Playwright globalSetup. Explicit env vars take precedence over .env.local, so its Atlas URI and
 * secrets are never used.
 */
import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { shareMongoBinaryDir } from "@showbuzz/config/vitest/mongo-binary";

const PORT = Number(process.env.E2E_PORT ?? 3100);

async function main() {
  shareMongoBinaryDir();
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = replSet.getUri();
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error("E2E expected a local in-memory MongoDB");

  const next = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      MONGODB_URI: uri,
      MONGODB_DB: "showbuzz_e2e",
      // Test-only values; real secrets stay in .env.local / Vercel.
      OTP_HASH_SECRET: "e2e-only-otp-hash-secret-0123456789abcdef",
      JWT_ACCESS_SECRET: "e2e-only-jwt-access-secret-0123456789abcdef",
      JWT_REFRESH_SECRET: "e2e-only-jwt-refresh-secret-0123456789abcdef",
      // Code on screen only (the dev banner the specs read), nothing written to logs.
      OTP_PROVIDER: "dev",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    },
  });

  const stop = async () => {
    next.kill();
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  next.on("exit", async (code) => {
    await replSet.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err: unknown) => {
  console.error("E2E server failed to start", err);
  process.exit(1);
});
