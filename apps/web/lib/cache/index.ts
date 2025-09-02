import "server-only";
import { type CacheService, createCacheService } from "@formbricks/cache";
import { logger } from "@formbricks/logger";

// Node.js module caching ensures this only initializes once
let cacheInstance: CacheService | null = null;
let initializationPromise: Promise<CacheService> | null = null;

async function initializeCache(): Promise<CacheService> {
  if (cacheInstance) {
    return cacheInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    logger.debug("Initializing cache service...");

    const result = await createCacheService();
    if (!result.ok) {
      logger.error("Cache service initialization failed", { error: result.error });
      throw new Error(`Cache initialization failed: ${result.error.code}`);
    }

    logger.debug("Cache service initialized successfully");
    cacheInstance = result.data;
    return result.data;
  })();

  return initializationPromise;
}

// Expose an async-leaning service to reflect lazy init for sync members like getRedisClient
type AsyncCacheService = Omit<CacheService, "getRedisClient"> & {
  getRedisClient(): Promise<ReturnType<CacheService["getRedisClient"]>>;
};

export const cache: AsyncCacheService = new Proxy({} as AsyncCacheService, {
  get(_target, prop: keyof CacheService) {
    // Special-case: withCache must never fail; fall back to direct fn on init failure.
    if (prop === "withCache") {
      return async (fn: (...args: any[]) => Promise<unknown>, ...rest: any[]) => {
        try {
          const svc = await initializeCache();
          // @ts-expect-error: types align at runtime
          return svc.withCache(fn, ...rest);
        } catch (error) {
          logger.warn({ error }, "Cache unavailable; executing function directly");
          return await fn();
        }
      };
    }

    // Default: lazily initialize and forward the call; returns a Promise for all methods
    return (...args: any[]) =>
      initializeCache().then((svc) => {
        const method = (svc as any)[prop] as Function;
        return method.apply(svc, args);
      });
  },
});
