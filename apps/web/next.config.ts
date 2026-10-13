import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Baseline security headers for every route (CSP follows in batch 8.2).
 * Permissions-Policy only turns off features nothing uses: the city picker needs geolocation and
 * YouTube trailer embeds need autoplay/fullscreen/encrypted-media, so those are left alone.
 */
function securityHeaders(isDev: boolean) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), usb=(), payment=(), browsing-topics=(), geolocation=(self)",
    },
  ];
  // HSTS only for production builds; on localhost it would pin HTTPS for every local project.
  if (!isDev) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return headers;
}

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    cacheComponents: true,
    // Shared workspace packages ship TypeScript source; Next compiles them like app code.
    transpilePackages: ["@showbuzz/core", "@showbuzz/db", "@showbuzz/runtime", "@showbuzz/schemas", "@showbuzz/ui", "@showbuzz/utils"],
    partialPrefetching: true,
    images: {
      // Prototype seed data uses Unsplash; replace once media storage is chosen.
      remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
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
