import { vi } from "vitest";

// `connection()` throws outside a Next.js request scope. Tests call route handlers directly, so it
// becomes a no-op here; everything else in next/server stays real.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
