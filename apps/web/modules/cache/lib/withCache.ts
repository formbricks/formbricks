import "server-only";
import { logger } from "@formbricks/logger";
import { getCache } from "./service";

/**
 * Simple cache wrapper for functions that return promises
 */

type CacheOptions = {
  key: string;
  ttl: number;
  serialize?: (data: any) => string;
  deserialize?: (data: string) => any;
};

/**
 * Simple cache wrapper for functions that return promises
 *
 * @example
 * ```typescript
 * const getCachedEnvironment = withCache(
 *   () => fetchEnvironmentFromDB(environmentId),
 *   {
 *     key: `env:${environmentId}`,
 *     ttl: 3600 // 1 hour
 *   }
 * );
 * ```
 */
export const withCache = <T>(fn: () => Promise<T>, options: CacheOptions): (() => Promise<T>) => {
  return async (): Promise<T> => {
    const { key, ttl, serialize = JSON.stringify, deserialize = JSON.parse } = options;

    try {
      const cache = await getCache();

      // Try to get from cache
      const cached = await cache.get<string>(key);

      if (cached !== null && cached !== undefined) {
        return deserialize(cached);
      }

      // Cache miss - fetch fresh data
      const fresh = await fn();

      // Cache the result
      await cache.set(key, serialize(fresh), ttl);

      return fresh;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // On cache error, still try to fetch fresh data
      logger.warn("Cache operation failed, fetching fresh data", { key, error: err });

      try {
        return await fn();
      } catch (fnError) {
        const fnErr = fnError instanceof Error ? fnError : new Error(String(fnError));
        logger.error("Failed to fetch fresh data after cache error", {
          key,
          cacheError: err,
          functionError: fnErr,
        });
        throw fnErr;
      }
    }
  };
};

/**
 * Simple cache invalidation helper
 * Prefer explicit key invalidation over complex tag systems
 */
export const invalidateCache = async (keys: string | string[]): Promise<void> => {
  const cache = await getCache();
  const keyArray = Array.isArray(keys) ? keys : [keys];

  await Promise.all(keyArray.map((key) => cache.del(key)));

  logger.info("Cache invalidated", { keys: keyArray });
};

// Re-export cache key utilities for backwards compatibility
export { createCacheKey, validateCacheKey, parseCacheKey } from "./cacheKeys";
