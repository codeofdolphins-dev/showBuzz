import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Same baseline headers as apps/admin (noindex: the portal must never appear in search results). The camera is
 * allowed for this origin only: the Scan Tickets screen reads ticket QR codes with it.
 */
function securityHeaders(isDev: boolean) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), usb=(), payment=(), browsing-topics=(), geolocation=()",
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
    experimental: {
      // KYC uploads go through a Server Action: 4 MB files (FileStorage limit) plus form overhead.
      serverActions: { bodySizeLimit: "5mb" },
    },
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
