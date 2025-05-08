// This cache handler follows the @fortedigital/nextjs-cache-handler example
// Read more at: https://github.com/fortedigital/nextjs-cache-handler

// @neshca/cache-handler dependencies
const { CacheHandler } = require("@neshca/cache-handler");
const createLruHandler = require("@neshca/cache-handler/local-lru").default;

// Next/Redis dependencies
const { createClient } = require("redis");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

// @fortedigital/nextjs-cache-handler dependencies
const createRedisHandler = require("@fortedigital/nextjs-cache-handler/redis-strings").default;
const { Next15CacheHandler } = require("@fortedigital/nextjs-cache-handler/next-15-cache-handler");

// Usual onCreation from @neshca/cache-handler
CacheHandler.onCreation(() => {
  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures only one instance get created
  if (global.cacheHandlerConfig) {
    return global.cacheHandlerConfig;
  }

  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures new instances are not created in a race condition
  if (global.cacheHandlerConfigPromise) {
    return global.cacheHandlerConfigPromise;
  }

  // If REDIS_URL is not set, we will use LRU cache only
  if (!process.env.REDIS_URL) {
    const lruCache = createLruHandler();
    return { handlers: [lruCache] };
  }

  // Main promise initializing the handler
  global.cacheHandlerConfigPromise = (async () => {
    /** @type {import("redis").RedisClientType | null} */
    let redisClient = null;
    // eslint-disable-next-line turbo/no-undeclared-env-vars -- Next.js will inject this variable
    if (PHASE_PRODUCTION_BUILD !== process.env.NEXT_PHASE) {
      const settings = {
        url: process.env.REDIS_URL, // Make sure you configure this variable
        pingInterval: 10000,
      };

      try {
        redisClient = createClient(settings);
        redisClient.on("error", (e) => {
          console.error("Redis error", e);
          global.cacheHandlerConfig = null;
          global.cacheHandlerConfigPromise = null;
        });
      } catch (error) {
        console.error("Failed to create Redis client:", error);
      }
    }

    if (redisClient) {
      try {
        console.info("Connecting Redis client...");
        await redisClient.connect();
        console.info("Redis client connected.");
      } catch (error) {
        console.error("Failed to connect Redis client:", error);
        await redisClient
          .disconnect()
          .catch(() => console.error("Failed to quit the Redis client after failing to connect."));
      }
    }
    const lruCache = createLruHandler();

    if (!redisClient?.isReady) {
      console.error("Failed to initialize caching layer.");
      global.cacheHandlerConfigPromise = null;
      global.cacheHandlerConfig = { handlers: [lruCache] };
      return global.cacheHandlerConfig;
    }

    createRedisHandler({
      client: redisClient,
      keyPrefix: "nextjs:",
    });

    global.cacheHandlerConfigPromise = null;

    return global.cacheHandlerConfig;
  })();

  return global.cacheHandlerConfigPromise;
});

module.exports = new Next15CacheHandler();
