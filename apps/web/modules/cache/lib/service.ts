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
  const memoryKeyvStore = new Keyv();

  return createCache({
    stores: [memoryKeyvStore],
  });
};

/**
 * Initialize and set memory cache as the singleton instance
 */
const initializeMemoryCache = (): Cache => {
  if (!state.instance) {
    state.instance = createMemoryCache();
    state.isInitialized = true;
    state.isRedisConnected = false;
  }
  return state.instance;
};

/**
 * Creates Redis cache with proper async connection handling
 */
const createRedisCache = async (redisUrl: string): Promise<Cache> => {
  try {
    logger.info("Creating Redis store with URL", { redisUrl: redisUrl.replace(/:[^:@]*@/, ":***@") });
    const redisStore = new KeyvRedis(redisUrl);

    // Create cache with Redis store
    const redisKeyvStore = new Keyv({
      store: redisStore,
    });

    const cache = createCache({
      stores: [redisKeyvStore],
    });

    // Test the connection with TTL to ensure Redis is working properly
    const testKey = "__health_check_with_ttl__";
    const testValue = { test: true, timestamp: Date.now() };
    const testTTL = 5000; // 5 seconds

    logger.info("Testing Redis connection with TTL test...");
    await cache.set(testKey, testValue, testTTL);

    const retrieved = await cache.get<typeof testValue>(testKey);
    if (!retrieved || retrieved.test !== true) {
      throw new Error("Redis cache test failed - value not retrieved correctly");
    }

    await cache.del(testKey);
    logger.info("Redis TTL test passed successfully");

    state.isRedisConnected = true;
    logger.info("Redis cache connected and verified successfully");
    return cache;
  } catch (error) {
    state.isRedisConnected = false;
    logger.error("Redis connection failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
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
        logger.warn(
          {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Failed to initialize Redis cache, falling back to memory cache"
        );

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
  return process.argv.some((arg) => arg.includes("build"));
};

/**
 * Get cache instance with proper async initialization
 */
export const getCache = async (): Promise<Cache> => {
  // Fast path for build time - return memory cache immediately, no async operations
  if (isBuildTime()) {
    return initializeMemoryCache();
  }

  // Fast path for no Redis URL - return memory cache immediately
  if (!process.env.REDIS_URL?.trim()) {
    return initializeMemoryCache();
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
