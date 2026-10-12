import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
// Next resolves "server-only" internally; outside Next it isn't installed, so tests use an empty stub.
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      { find: /^server-only$/, replacement: serverOnlyStub },
    ],
  },
  test: {
    // Placeholders so modules that read env.ts load in unit tests. ".invalid" never resolves, so an
    // accidental connect() fails fast; integration tests override these with the in-memory server.
    env: {
      MONGODB_URI: "mongodb://unit-tests.invalid:27017",
      MONGODB_DB: "showbuzz_unit",
      OTP_HASH_SECRET: "test-only-otp-hash-secret-0123456789abcdef",
      JWT_ACCESS_SECRET: "test-only-jwt-access-secret-0123456789abcdef",
      JWT_REFRESH_SECRET: "test-only-jwt-refresh-secret-0123456789abcdef",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/next-request.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "unit-dom",
          include: ["tests/unit/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/setup/dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts", "tests/setup/next-request.ts"],
          // One shared replica set: run files one at a time so tests can't trip over each other's data.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
