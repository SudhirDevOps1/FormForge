import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { KVNamespace } from "@cloudflare/workers-types";

/**
 * Read-through cache in front of D1.
 *
 * The Worker has a hard ceiling of 100,000 requests/day and D1 bills every
 * row read, so endpoints that are polled by every visitor (public counters,
 * live stats) and per-request auth lookups must not hit the database each
 * time.
 *
 * Two layers, both optional by design:
 *
 *   1. **L1 — per-isolate memory.** A few milliseconds, no I/O. Cloudflare
 *      reuses an isolate for many requests, so repeated polls inside the same
 *      isolate cost nothing at all.
 *   2. **L2 — Cloudflare KV** (binding `CACHE`). Shared by every isolate and
 *      every colo, so a cache miss in a fresh isolate still avoids D1.
 *
 * If the KV binding is not configured (for example a fresh clone, a preview
 * deployment, or the Node dev server) the code silently falls back to L1 only.
 * Nothing breaks and no request fails because a cache is missing — the
 * `cached()` helper simply loads from D1 as before.
 */

const KEY_PREFIX = "ff:v1:";
/** Long enough to absorb dashboard polling, short enough to stay fresh. */
const MEMORY_TTL_MS = 15_000;
const MEMORY_MAX_ENTRIES = 500;

type MemoryEntry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as typeof globalThis & {
  __formforgeCacheL1?: Map<string, MemoryEntry>;
  __formforgeCacheInFlight?: Map<string, Promise<unknown>>;
};

const memory = (globalForCache.__formforgeCacheL1 ??= new Map());
const inFlight = (globalForCache.__formforgeCacheInFlight ??= new Map());

type CacheEnv = { CACHE?: KVNamespace };

/** Resolve the KV binding, or `null` when it is not configured. */
function readKv(): KVNamespace | null {
  try {
    const env = getCloudflareContext().env as CacheEnv | undefined;
    return env?.CACHE ?? null;
  } catch {
    // Outside a Cloudflare request context (Node dev server, unit tests).
    return null;
  }
}

/** True when the shared KV layer is available. */
export function isKvCacheAvailable(): boolean {
  return readKv() !== null;
}

function memoryGet<T>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

function memorySet(key: string, value: unknown, ttlSeconds: number): void {
  // Bound the map so a long-lived isolate cannot leak memory.
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
  memory.set(key, {
    value,
    expiresAt: Date.now() + Math.min(ttlSeconds * 1000, MEMORY_TTL_MS),
  });
}

/** Namespaced cache key; keeps unrelated deployments/versions apart. */
export function cacheKey(...parts: Array<string | number>): string {
  return KEY_PREFIX + parts.join(":");
}

/**
 * Read a value from L1 then KV.
 *
 * Values are wrapped in `{ v }` so a cached `null` (a negative result such as
 * "this session is invalid") is distinguishable from a cache miss.
 */
export async function readCached<T>(key: string): Promise<T | null> {
  const local = memoryGet<{ v: T }>(key);
  if (local) return local.v;

  const kv = readKv();
  if (!kv) return null;

  try {
    const raw = await kv.get(key, "json");
    if (raw === null || raw === undefined) return null;
    const parsed = raw as { v?: T };
    if (typeof parsed !== "object" || !("v" in parsed)) return null;
    memorySet(key, parsed, MEMORY_TTL_MS / 1000);
    return parsed.v as T;
  } catch {
    // A broken cache must never break the request.
    return null;
  }
}

/** Write a value to L1 and KV with a TTL in seconds. */
export async function writeCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  memorySet(key, { v: value }, ttlSeconds);

  const kv = readKv();
  if (!kv) return;

  try {
    await kv.put(key, JSON.stringify({ v: value }), {
      expirationTtl: Math.max(60, Math.floor(ttlSeconds)),
    });
  } catch {
    // Best effort: the L1 entry still serves this isolate.
  }
}

/** Drop one key (or several) from both layers. */
export async function invalidateCached(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];
  const kv = readKv();

  await Promise.all(
    list.map(async (key) => {
      memory.delete(key);
      if (!kv) return;
      try {
        await kv.delete(key);
      } catch {
        // The TTL is the backstop when an explicit delete fails.
      }
    }),
  );
}

/**
 * Read-through cache: return the cached value, otherwise run `load()` once
 * (concurrent callers share the same promise) and cache the result.
 *
 * `load` must be idempotent — it runs at most once per TTL per isolate.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await readCached<T>(key);
  if (hit !== null) return hit;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await load();
      await writeCached(key, value, ttlSeconds);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Test helper: clear both layers without touching the network. */
export function __clearCacheForTests(): void {
  memory.clear();
  inFlight.clear();
}
