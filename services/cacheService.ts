/**
 * Optional Redis caching layer using Upstash.
 *
 * Enable by setting environment variables:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * When env vars are missing, all cache operations gracefully no-op.
 */

import { Redis } from '@upstash/redis';

// ── Configuration ──────────────────────────────
const CACHE_ENABLED =
  typeof process !== 'undefined' &&
  !!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL &&
  !!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (CACHE_ENABLED) {
  redis = new Redis({
    url: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL!,
    token: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN!,
  });
}

// ── Default TTL (seconds) ──────────────────────
const DEFAULT_TTL = 90; // 90 seconds

// ── Public API ─────────────────────────────────

/**
 * Retrieve cached value by key.
 * Returns null if cache is disabled or key not found.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch {
    return null;
  }
}

/**
 * Store value in cache with TTL.
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch {
    // Silently fail — cache is optional
  }
}

/**
 * Remove a specific key from cache.
 */
export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Silently fail
  }
}

/**
 * Remove all keys matching a pattern (e.g. "fighters:*").
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => redis!.del(k)));
    }
  } catch {
    // Silently fail
  }
}

/**
 * Build a standardized cache key for fighter searches.
 */
export function buildFighterCacheKey(filters: {
  weight_class?: string;
  city?: string;
  short_notice_ready?: boolean;
  page?: number;
}): string {
  const wc = filters.weight_class || 'all';
  const city = filters.city || 'all';
  const sn = filters.short_notice_ready ? '1' : '0';
  const pg = filters.page ?? 1;
  return `fighters:${wc}:${city}:${sn}:${pg}`;
}

export { CACHE_ENABLED };
