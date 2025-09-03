import "server-only";
import { type CacheService, getCacheService } from "@formbricks/cache";
import { logger } from "@formbricks/logger";

/**
 * Cache facade for the cache service
 * Provides a proxy to the cache service methods
 * Lazy initializes the cache service on first use
 * Handles cache service initialization failures gracefully
 * Avoid the need to use of double awaits when using the cache service (e.g. await (await cache).get(key))
 */
export const cache = new Proxy({} as CacheService, {
  get(_target, prop: keyof CacheService) {
    // Special-case: withCache must never fail; fall back to direct fn on init failure.
    if (prop === "withCache") {
      return async (fn: (...args: any[]) => Promise<unknown>, ...rest: any[]) => {
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

    // Default: lazily initialize and forward the call; returns a Promise for all methods
    return async (...args: any[]) => {
      const cacheServiceResult = await getCacheService();

      if (!cacheServiceResult.ok) {
        return { ok: false, error: cacheServiceResult.error };
      }
      const method = (cacheServiceResult.data as any)[prop] as Function;

      return await method.apply(cacheServiceResult.data, args);
    };
  },
});
