import { CacheHandler } from "@neshca/cache-handler";
import createLruHandler from "@neshca/cache-handler/local-lru";
import createRedisHandler from "@neshca/cache-handler/redis-strings";
import { createClient } from "redis";

// Function to create a timeout promise
const createTimeoutPromise = (ms, rejectReason) => {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(rejectReason)), ms));
};

CacheHandler.onCreation(async () => {
  let client;

  if (process.env.REDIS_URL && process.env.ENTERPRISE_LICENSE_KEY) {
    try {
      // Create a Redis client.
      client = createClient({
        url: process.env.REDIS_URL,
      });

      // Redis won't work without error handling.
      client.on("error", () => {});
    } catch (error) {
      console.warn("Failed to create Redis client:", error);
    }

    if (client) {
      try {
        // Wait for the client to connect with a timeout of 5000ms.
        const connectPromise = client.connect();
        const timeoutPromise = createTimeoutPromise(5000, "Redis connection timed out"); // 5000ms timeout
        await Promise.race([connectPromise, timeoutPromise]);
      } catch (error) {
        console.warn("Failed to connect Redis client:", error);

        console.warn("Disconnecting the Redis client...");
        // Try to disconnect the client to stop it from reconnecting.
        client
          .disconnect()
          .then(() => {
            console.info("Redis client disconnected.");
          })
          .catch(() => {
            console.warn("Failed to quit the Redis client after failing to connect.");
          });
      }
    }
  } else if (process.env.REDIS_URL) {
    console.log("Redis clustering requires an Enterprise License. Falling back to LRU cache.");
  }

  /** @type {import("@neshca/cache-handler").Handler | null} */
  let handler;

  if (client?.isReady) {
    // Create the `redis-stack` Handler if the client is available and connected.
    handler = await createRedisHandler({
      client,
      keyPrefix: "fb:",
      timeoutMs: 1000,
    });
  } else {
    // Fallback to LRU handler if Redis client is not available.
    // The application will still work, but the cache will be in memory only and not shared.
    handler = createLruHandler();
    console.log("Using LRU handler for caching.");
  }

  return {
    handlers: [handler],
  };
});

export default CacheHandler;
