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
      // Try Redis first if URL is provided
      if (process.env.REDIS_URL?.trim()) {
        try {
          logger.info("Attempting to connect to Redis cache...");
          const redisCache = await createRedisCache(process.env.REDIS_URL);
          state.instance = redisCache;
          state.isRedisConnected = true;
          logger.info("Cache service initialized with Redis");
          return redisCache;
        } catch (error) {
          logger.warn("Failed to initialize Redis cache, falling back to memory cache", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        logger.info("REDIS_URL not provided, using memory cache");
      }

      // Fallback to memory cache
      const memoryCache = createMemoryCache();
      state.instance = memoryCache;
      state.isRedisConnected = false;
      logger.info("Cache service initialized with in-memory storage");
      return memoryCache;
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
 * Get cache instance with proper async initialization
 */
export const getCache = async (): Promise<Cache> => {
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
