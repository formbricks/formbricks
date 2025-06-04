import "server-only";
import KeyvRedis from "@keyv/redis";
import { type Cache, createCache } from "cache-manager";
import { Keyv } from "keyv";
import { logger } from "@formbricks/logger";

// Singleton state management
interface CacheState {
  instance: Cache | null;
  isInitialized: boolean;
  isRedisConnected: boolean;
  initializationPromise: Promise<Cache> | null;
}

const state: CacheState = {
  instance: null,
  isInitialized: false,
  isRedisConnected: false,
  initializationPromise: null,
};

/**
 * Creates a memory cache fallback
 */
const createMemoryCache = (): Cache => {
  return createCache({ stores: [new Keyv()] });
};

/**
 * Creates Redis cache with proper async connection handling
 */
const createRedisCache = async (redisUrl: string): Promise<Cache> => {
  const redisStore = new KeyvRedis(redisUrl);
  const cache = createCache({ stores: [new Keyv({ store: redisStore })] });

  // Test connection
  const testKey = "__health_check__";
  await cache.set(testKey, { test: true }, 5000);
  const result = await cache.get<{ test: boolean }>(testKey);
  await cache.del(testKey);

  if (!result?.test) {
    throw new Error("Redis connection test failed");
  }

  return cache;
};

/**
 * Async cache initialization with proper singleton pattern
 */
const initializeCache = async (): Promise<Cache> => {
  if (state.initializationPromise) {
    return state.initializationPromise;
  }

  state.initializationPromise = (async () => {
    try {
      const redisUrl = process.env.REDIS_URL?.trim();

      if (!redisUrl) {
        state.instance = createMemoryCache();
        state.isRedisConnected = false;
        return state.instance;
      }

      try {
        state.instance = await createRedisCache(redisUrl);
        state.isRedisConnected = true;
        logger.info("Cache initialized with Redis");
      } catch (error) {
        logger.warn("Redis connection failed, using memory cache", { error });
        state.instance = createMemoryCache();
        state.isRedisConnected = false;
      }

      return state.instance;
    } catch (error) {
      logger.error("Cache initialization failed", { error });
      state.instance = createMemoryCache();
      return state.instance;
    } finally {
      state.isInitialized = true;
      state.initializationPromise = null;
    }
  })();

  return state.initializationPromise;
};

/**
 * Simple Next.js build environment detection
 * Works in 99% of cases with minimal complexity
 */
const isBuildTime = () => !process.env.NEXT_RUNTIME;

/**
 * Get cache instance with proper async initialization
 * Always re-evaluates Redis URL at runtime to handle build-time vs runtime differences
 */
export const getCache = async (): Promise<Cache> => {
  if (isBuildTime()) {
    if (!state.instance) {
      state.instance = createMemoryCache();
      state.isInitialized = true;
      state.isRedisConnected = false;
    }
    return state.instance;
  }

  const currentRedisUrl = process.env.REDIS_URL?.trim();

  // Re-initialize if Redis URL is now available but we're using memory cache
  if (state.instance && state.isInitialized && !state.isRedisConnected && currentRedisUrl) {
    logger.info("Re-initializing cache with Redis");
    state.instance = null;
    state.isInitialized = false;
    state.initializationPromise = null;
  }

  if (state.instance && state.isInitialized) {
    return state.instance;
  }

  return initializeCache();
};

/**
 * Cache health monitoring for diagnostics
 */
export const getCacheHealth = () => ({
  isInitialized: state.isInitialized,
  isRedisConnected: state.isRedisConnected,
  hasInstance: !!state.instance,
});
