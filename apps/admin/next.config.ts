import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Same baseline headers as apps/web, plus noindex: the console must never appear in search results.
 * The admin needs no geolocation, so Permissions-Policy turns it off too.
 */
function securityHeaders(isDev: boolean) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), usb=(), payment=(), browsing-topics=(), geolocation=()",
    },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ];
  // HSTS only for production builds; on localhost it would pin HTTPS for every local project.
  if (!isDev) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return headers;
}

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    // Shared workspace packages ship TypeScript source; Next compiles them like app code.
    transpilePackages: [
      "@showbuzz/console-ui",
      "@showbuzz/core",
      "@showbuzz/db",
      "@showbuzz/runtime",
      "@showbuzz/schemas",
      "@showbuzz/utils",
    ],
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders(isDev) }];
    },
  };
}
