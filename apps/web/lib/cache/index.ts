import "server-only";
import { type CacheKey, type CacheService, createCacheService } from "@formbricks/cache";
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
    logger.info("Initializing cache service...");

    const result = await createCacheService();
    if (!result.ok) {
      logger.error("Cache service initialization failed", { error: result.error });
      throw new Error(`Cache initialization failed: ${result.error.code}`);
    }

    logger.info("Cache service initialized successfully");
    cacheInstance = result.data;
    return result.data;
  })();

  return initializationPromise;
}

// Type-safe Proxy that preserves all TypeScript benefits while avoiding double await
export const cache: CacheService = new Proxy({} as CacheService, {
  get(_target, prop: keyof CacheService) {
    // Return a function that matches the original method signature
    return async (...args: any[]) => {
      const cacheService = await initializeCache();
      const method = cacheService[prop] as Function;
      return method.apply(cacheService, args);
    };
  },
});
