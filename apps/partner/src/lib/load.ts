import "server-only";
import { log } from "@showbuzz/runtime/log";

/**
 * Runs a page's data load and reports failure as a value, so the page can render its error state without building
 * JSX inside try/catch (rendering errors belong to error boundaries; this only covers the data fetch).
 */
export async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    log.error("Partner page data failed to load", { err });
    return { ok: false };
  }
}
