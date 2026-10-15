import "server-only";

/**
 * A tiny per-instance cache for expensive read-only aggregations (dashboards). The console apps don't use Cache
 * Components, so `"use cache"` isn't available there; a short TTL in memory keeps a busy dashboard from
 * re-aggregating on every request. Each server instance has its own copy (fine for figures that may be minutes old).
 * Concurrent misses for one key share a single load.
 */

interface Entry {
  expiresAt: number;
  value: Promise<unknown>;
}

const MAX_ENTRIES = 500;

const store: Map<string, Entry> = ((globalThis as { _sbTtlCache?: Map<string, Entry> })._sbTtlCache ??= new Map());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  if (store.size >= MAX_ENTRIES) {
    for (const [k, entry] of store) if (entry.expiresAt <= now) store.delete(k);
    if (store.size >= MAX_ENTRIES) store.clear();
  }
  const value = load();
  store.set(key, { expiresAt: now + ttlMs, value });
  // A failed load must not be served from the cache.
  value.catch(() => store.delete(key));
  return value;
}
