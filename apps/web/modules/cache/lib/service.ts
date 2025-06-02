import "server-only";
import KeyvRedis from "@keyv/redis";
import { type Cache, createCache } from "cache-manager";
import { Keyv } from "keyv";
import { logger } from "@formbricks/logger";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

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
  const memoryKeyvStore = new Keyv({
    ttl: CACHE_TTL_MS,
  });

  return createCache({
    stores: [memoryKeyvStore],
    ttl: CACHE_TTL_MS,
  });
};

/**
 * Creates Redis cache with proper async connection handling
 */
const createRedisCache = async (redisUrl: string): Promise<Cache> => {
  try {
    const redisStore = new KeyvRedis(redisUrl);

    // Create cache with Redis store
    const redisKeyvStore = new Keyv({
      store: redisStore,
      ttl: CACHE_TTL_MS,
    });

    const cache = createCache({
      stores: [redisKeyvStore],
      ttl: CACHE_TTL_MS,
    });

    // Test the connection by doing a simple operation
    await cache.set("__health_check__", "test", 1000);
    await cache.del("__health_check__");

    state.isRedisConnected = true;
    logger.info("Redis cache connected successfully");
    return cache;
  } catch (error) {
    state.isRedisConnected = false;
    logger.error("Redis connection failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Async cache initialization with proper singleton pattern
 */
const initializeCache = async (): Promise<Cache> => {
  // Prevent multiple simultaneous initializations (critical for singleton)
  if (state.initializationPromise) {
    return state.initializationPromise;
  }

  state.initializationPromise = (async () => {
    try {
      // Skip Redis during build time to prevent build hangs
      // During build, Redis typically isn't available, so we detect this condition
      const shouldSkipRedis = !process.env.REDIS_URL?.trim();

      if (shouldSkipRedis) {
        logger.info("No Redis URL available, using memory cache");
        const memoryCache = createMemoryCache();
        state.instance = memoryCache;
        state.isRedisConnected = false;
        logger.info("Cache service initialized with in-memory storage");
        return memoryCache;
      }

      // Try Redis connection
      try {
        logger.info("Attempting to connect to Redis cache...");
        const redisCache = await createRedisCache(process.env.REDIS_URL!);
        state.instance = redisCache;
        state.isRedisConnected = true;
        logger.info("Cache service initialized with Redis");
        return redisCache;
      } catch (error) {
        logger.warn("Failed to initialize Redis cache, falling back to memory cache", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Fallback to memory cache
        const memoryCache = createMemoryCache();
        state.instance = memoryCache;
        state.isRedisConnected = false;
        logger.info("Cache service initialized with in-memory storage");
        return memoryCache;
      }
    } catch (error) {
      logger.error("Critical error during cache initialization", { error });
      // Emergency fallback
      const emergencyCache = createMemoryCache();
      state.instance = emergencyCache;
      return emergencyCache;
    } finally {
      state.isInitialized = true;
      state.initializationPromise = null;
    }
  })();

  return state.initializationPromise;
};

/**
 * Detect if we're in a build environment
 */
const isBuildTime = () => {
  return (
    process.argv.some((arg) => arg.includes("build")) ||
    (process.argv.some((arg) => arg.includes("next")) && process.env.NODE_ENV === "production")
  );
};

/**
 * Get cache instance with proper async initialization
 */
export const getCache = async (): Promise<Cache> => {
  // Fast path for build time - return memory cache immediately, no async operations
  if (isBuildTime()) {
    if (!state.instance) {
      state.instance = createMemoryCache();
      state.isInitialized = true;
      state.isRedisConnected = false;
    }
    return state.instance;
  }

  // Fast path for no Redis URL - return memory cache immediately
  if (!process.env.REDIS_URL?.trim()) {
    if (!state.instance) {
      state.instance = createMemoryCache();
      state.isInitialized = true;
      state.isRedisConnected = false;
    }
    return state.instance;
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
