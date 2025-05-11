import KeyvRedis from "@keyv/redis";
import { type Cache, createCache } from "cache-manager";
import { Keyv } from "keyv";
import { logger } from "@formbricks/logger";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

let cache: Cache;

if (process.env.REDIS_URL) {
  const redisKeyvStore = new Keyv({
    store: new KeyvRedis(process.env.REDIS_URL),
    ttl: CACHE_TTL_MS, // Default TTL for items in this store
  });
  cache = createCache({
    stores: [redisKeyvStore],
    ttl: CACHE_TTL_MS, // Default TTL for the cache instance
  });
} else {
  logger.warn("REDIS_URL not found, falling back to in-memory cache.");
  const memoryKeyvStore = new Keyv({
    ttl: CACHE_TTL_MS, // Default TTL for items in this store
  });
  cache = createCache({
    stores: [memoryKeyvStore],
    ttl: CACHE_TTL_MS, // Default TTL for the cache instance
    // Note: The 'max' option for memory store size is not directly supported by Keyv's default in-memory store.
    // For LRU or size-limited caches, a specific Keyv adapter like 'lru-cache' or 'cacheable-memory' would be needed.
  });
}

export const getCache = (): Cache => {
  return cache;
};
