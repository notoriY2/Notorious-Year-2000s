// src/lib/requestCache.ts
//
// Generic, app-wide helpers for two related problems that were both
// showing up as `57014 canceling statement due to statement timeout`:
//
// 1. CACHING — avoid re-fetching the same data from Supabase within a
//    short TTL window (see `cached()`).
// 2. CONCURRENCY LIMITING — avoid opening more than a handful of
//    Supabase requests at the same instant, regardless of which
//    component or hook triggered them (see `withConcurrencyLimit()`).
//
// Problem #2 is what actually caused the timeouts: opening the admin
// dashboard (or just switching tabs quickly) could fire 20-30 Supabase
// queries in the same tick. On a small/free connection pool, those
// requests queue for a free connection long enough to blow past the
// anon/authenticated statement_timeout — even for tiny, unrelated,
// well-indexed queries like the public storefront's product fetch.
//
// This module is shared by `lib/adminCache.ts` (admin-only cache) and
// `hooks/useProducts.ts` (storefront cache), so every cached Supabase
// read in the app funnels through the same concurrency limiter. That
// means the admin panel can never starve the storefront (or vice
// versa) no matter what a person clicks.

// ============================================================
// CONCURRENCY LIMITER
// ============================================================

// Max number of Supabase requests allowed to be "in flight" at once,
// app-wide. Everything beyond this queues and waits for a free slot
// instead of firing immediately. Tune this to your Supabase plan's
// connection pool size — small/free tiers often only have a handful
// of usable connections, so keep this conservative. Raise it once
// you've confirmed your pool/statement_timeout can comfortably absorb
// more concurrent requests.
const MAX_CONCURRENT_REQUESTS = 6;

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

const acquireSlot = (): Promise<void> => {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }

  return new Promise(resolve => {
    waitQueue.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
};

const releaseSlot = (): void => {
  activeRequests = Math.max(0, activeRequests - 1);

  const next = waitQueue.shift();

  if (next) {
    next();
  }
};

/**
 * Runs `fn` once a concurrency slot is available. Guarantees the slot
 * is released whether `fn` resolves or rejects.
 *
 * `cached()` below already wraps every fetcher in this automatically.
 * Only reach for this directly if you have an uncached Supabase call
 * site that still needs to respect the app-wide concurrency cap.
 */
export async function withConcurrencyLimit<T>(
  fn: () => Promise<T>
): Promise<T> {
  await acquireSlot();

  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

// ============================================================
// TTL CACHE (generic — keyed by an arbitrary string)
// ============================================================

interface CacheEntry<T> {
  data: T;
  storedAt: number;
}

// Module-level singletons — shared by every importer (admin cache AND
// the storefront product hook), so a key like 'products:active' is
// genuinely shared/deduped across the whole app, not per-feature.
const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL_MS = 60_000;

// ============================================================
// CIRCUIT BREAKER — network outage protection
// ============================================================
// When a fetch fails with a network-level error (not an HTTP error —
// the backend never responded at all), don't let every hook in the
// app independently retry against a dead backend. Mark the network
// "down" for a cooldown window; anything calling cached() during that
// window fails fast instead of opening yet another doomed request.
const NETWORK_DOWN_COOLDOWN_MS = 15_000;
let networkDownUntil = 0;

const isNetworkLevelError = (error: unknown): boolean =>
  error instanceof TypeError &&
  /failed to fetch/i.test((error as TypeError).message ?? '');

const isNetworkDown = (): boolean => Date.now() < networkDownUntil;

/**
 * Returns a cached value for `key` if it's still fresh. Otherwise runs
 * `fetcher()` (through the concurrency limiter above), stores the
 * result, and returns it. Concurrent callers for the same key while a
 * fetch is already in flight share that single promise instead of
 * firing duplicate requests (this is what protects against React
 * StrictMode's double-invoke in development, too).
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  if (isNetworkDown()) {
    throw new Error('Network unavailable — backend unreachable, retry paused.');
  }

  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && Date.now() - existing.storedAt < ttlMs) {
    return existing.data;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;

  if (pending) {
    return pending;
  }

  const request = withConcurrencyLimit(fetcher)
    .then(data => {
      store.set(key, { data, storedAt: Date.now() });
      inflight.delete(key);
      networkDownUntil = 0; // a success clears the breaker
      return data;
    })
    .catch(error => {
      // Don't cache failures — the next call should retry cleanly.
      inflight.delete(key);
      if (isNetworkLevelError(error)) {
        networkDownUntil = Date.now() + NETWORK_DOWN_COOLDOWN_MS;
      }
      throw error;
    });

  inflight.set(key, request);

  return request;
}

/**
 * Clears cached entries. Call with no arguments to clear everything,
 * or a string prefix to clear only matching keys (e.g. 'products:'
 * clears both 'products:all' and 'products:active').
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }

  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function invalidateCacheKey(key: string): void {
  store.delete(key);
}

export function isCached(key: string, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const existing = store.get(key);
  return !!existing && Date.now() - existing.storedAt < ttlMs;
}