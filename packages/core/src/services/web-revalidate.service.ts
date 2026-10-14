import "server-only";
import { after } from "next/server";
import { log } from "@showbuzz/runtime/log";
import { webAppOrigin } from "@showbuzz/runtime/web-app-env";
import { internalAuthorizationHeader } from "../http/internal-auth";
import type { CatalogTag } from "./catalog-tags";

const TIMEOUT_MS = 5000;

/**
 * Refreshes showbuzz.com's cached catalogue after a console edit (the consoles are separate deployments, so their
 * own revalidateTag can't reach the public app's cache). Best effort: runs after the response is sent, so it never
 * delays or fails a save; failures are logged and the public cache catches up when its lifetime ends.
 */
export function revalidateWeb(tags: CatalogTag[]): void {
  const unique = [...new Set(tags)];
  if (unique.length === 0) return;
  after(() => sendRevalidate(unique));
}

async function sendRevalidate(tags: CatalogTag[]): Promise<void> {
  const url = `${webAppOrigin}/api/internal/revalidate`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: internalAuthorizationHeader() },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      log.warn("Web revalidate failed", { event: "web.revalidate_failed", status: response.status, tags });
    }
  } catch (err) {
    log.warn("Web revalidate unreachable", {
      event: "web.revalidate_failed",
      tags,
      error: err instanceof Error ? err.name : "unknown",
    });
  }
}
