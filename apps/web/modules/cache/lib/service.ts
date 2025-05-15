import "server-only";
import KeyvRedis from "@keyv/redis";
import { type Cache, createCache } from "cache-manager";
import { Keyv } from "keyv";
import { logger } from "@formbricks/logger";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

let cache: Cache;

const initializeMemoryCache = (): void => {
  const memoryKeyvStore = new Keyv({
    ttl: CACHE_TTL_MS,
  });
  cache = createCache({
    stores: [memoryKeyvStore],
    ttl: CACHE_TTL_MS,
  });
  logger.info("Using in-memory cache");
};

if (process.env.REDIS_URL) {
  try {
    const redisStore = new KeyvRedis(process.env.REDIS_URL);

    // Gracefully fall back if Redis dies later on
    redisStore.on("error", (err) => {
      logger.error("Redis connection lost – switching to in-memory cache", { error: err });
      initializeMemoryCache();
    });

    const redisKeyvStore = new Keyv({
      store: redisStore,
      ttl: CACHE_TTL_MS,
    });

    cache = createCache({
      stores: [redisKeyvStore],
      ttl: CACHE_TTL_MS,
    });
    logger.info("Successfully connected to Redis cache");
  } catch (error) {
    logger.error("Failed to connect to Redis cache:", error);
    logger.warn("Falling back to in-memory cache due to Redis connection failure");
    initializeMemoryCache();
  }
} else {
  logger.warn("REDIS_URL not found, falling back to in-memory cache.");
  initializeMemoryCache();
}

export const getCache = (): Cache => {
  return cache;
};
