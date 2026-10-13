import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = (file) => fileURLToPath(new URL(file, import.meta.url));

/**
 * Shared Vitest setup for every workspace. Each workspace gets the same projects the single app had:
 * - unit:        tests/unit/**\/*.test.ts, node
 * - unit-dom:    tests/unit/**\/*.test.tsx, jsdom
 * - integration: tests/integration/**\/*.test.ts, in-memory MongoDB replica set, one file at a time
 *
 * @param {object} options
 * @param {Array<"unit" | "unit-dom" | "integration">} options.projects which projects this workspace has
 * @param {boolean} [options.next] stub next/server `connection()` (workspaces whose code imports next/server)
 * @param {import("vite").AliasOptions} [options.alias] extra aliases, e.g. an app's "@/"
 */
export function defineShowbuzzVitest({ projects, next = false, alias = [] }) {
  const nextSetup = next ? [here("./next-request.ts")] : [];
  const all = {
    unit: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
      environment: "node",
      setupFiles: nextSetup,
    },
    "unit-dom": {
      name: "unit-dom",
      include: ["tests/unit/**/*.test.tsx"],
      environment: "jsdom",
      setupFiles: [here("./dom.ts")],
    },
    integration: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      environment: "node",
      globalSetup: [here("./mongo-global-setup.ts")],
      setupFiles: [here("./mongo-setup.ts"), ...nextSetup],
      // One shared replica set: run files one at a time so tests can't trip over each other's data.
      fileParallelism: false,
      testTimeout: 20_000,
      hookTimeout: 120_000,
    },
  };

  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: [
        ...(Array.isArray(alias) ? alias : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))),
        // Next resolves "server-only" internally; outside Next it isn't installed, so tests use an empty stub.
        { find: /^server-only$/, replacement: here("./server-only.ts") },
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
        ADMIN_JWT_ACCESS_SECRET: "test-only-admin-access-secret-0123456789abcdef",
        ADMIN_JWT_REFRESH_SECRET: "test-only-admin-refresh-secret-0123456789abcdef",
      },
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.d.ts"],
      },
      projects: projects.map((name) => ({ extends: true, test: all[name] })),
    },
  });
}
