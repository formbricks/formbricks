import "server-only";
import type { RedisClientType } from "redis";
import { getCacheService } from "@formbricks/cache";
import { logger } from "@formbricks/logger";

type CacheResult<T, E = { code: string }> = { ok: true; data: T } | { ok: false; error: E };

type CacheService = {
  get<T>(key: string): Promise<CacheResult<T | null>>;
  exists(key: string): Promise<CacheResult<boolean>>;
  set(key: string, value: unknown, ttlMs?: number): Promise<CacheResult<void>>;
  del(keys: string[]): Promise<CacheResult<void>>;
  tryLock(key: string, value: string, ttlMs: number): Promise<CacheResult<boolean>>;
  withCache<T>(fn: () => Promise<T>, key: string, ttlMs: number): Promise<T>;
  getRedisClient(): RedisClientType | null;
};

// Expose an async-leaning service to reflect lazy init for sync members like getRedisClient
type AsyncCacheService = Omit<CacheService, "getRedisClient"> & {
  getRedisClient(): Promise<ReturnType<CacheService["getRedisClient"]>>;
};

/**
 * Cache facade for the cache service
 * Provides a proxy to the cache service methods
 * Lazy initializes the cache service on first use
 * Handles cache service initialization failures gracefully
 * Avoid the need to use double awaits when using the cache service (e.g. await (await cache).get(key))
 */
export const cache = new Proxy({} as AsyncCacheService, {
  get(_target, prop: keyof CacheService) {
    // Special-case: withCache must never fail; fall back to direct fn on init failure.
    if (prop === "withCache") {
      return async <T>(fn: () => Promise<T>, ...rest: [string, number]) => {
        try {
          const cacheServiceResult = await getCacheService();

          if (!cacheServiceResult.ok) {
            return await fn();
          }

          const cacheService = cacheServiceResult.data as CacheService;
          return cacheService.withCache(fn, ...rest);
        } catch (error) {
          logger.warn({ error }, "Cache unavailable; executing function directly");
          return await fn();
        }
      };
    }

    if (prop === "getRedisClient") {
      return async () => {
        const cacheServiceResult = await getCacheService();
        if (!cacheServiceResult.ok) {
          return null;
        }
        const cacheService = cacheServiceResult.data as CacheService;
        return cacheService.getRedisClient();
      };
    }

    // Default: lazily initialize and forward the call; returns a Promise for all methods
    return async (...args: Parameters<CacheService[typeof prop]>) => {
      const cacheServiceResult = await getCacheService();

      if (!cacheServiceResult.ok) {
        return {
          ok: false,
          error: cacheServiceResult.error,
        } as unknown as ReturnType<CacheService[typeof prop]>;
      }

      const cacheService = cacheServiceResult.data as CacheService;
      const method = cacheService[prop] as (...args: unknown[]) => unknown;

      return await method.apply(cacheService, args);
    };
  },
});
