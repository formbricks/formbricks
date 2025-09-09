import "server-only";
import { type CacheKey, type CacheService, getCacheService } from "@formbricks/cache";
import { logger } from "@formbricks/logger";

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
      return async <T>(fn: () => Promise<T>, ...rest: [CacheKey, number]) => {
        try {
          const cacheServiceResult = await getCacheService();

          if (!cacheServiceResult.ok) {
            return await fn();
          }

          return cacheServiceResult.data.withCache(fn, ...rest);
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
        return cacheServiceResult.data.getRedisClient();
      };
    }

    // Default: lazily initialize and forward the call; returns a Promise for all methods
    return async (...args: Parameters<CacheService[typeof prop]>) => {
      const cacheServiceResult = await getCacheService();

      if (!cacheServiceResult.ok) {
        return { ok: false, error: cacheServiceResult.error };
      }
      const method = cacheServiceResult.data[prop];

      return await method.apply(cacheServiceResult.data, args);
    };
  },
});
