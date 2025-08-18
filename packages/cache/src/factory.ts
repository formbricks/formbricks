import { type RedisClientType, createClient } from "redis";
import { logger } from "@formbricks/logger";

export type RedisClient = RedisClientType;

/**
 * Creates a Redis client from the REDIS_URL environment variable
 * @throws Error If REDIS_URL is not set
 */
export function createRedisClientFromEnv(): RedisClient {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for @formbricks/cache");
  }

  const client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        logger.info(`Redis reconnection attempt ${String(retries)}`);

        // For the first 5 attempts, use exponential backoff with max 5 second delay
        if (retries <= 5) {
          return Math.min(retries * 1000, 5000);
        }

        // After 5 attempts, use a longer delay but never give up
        // This ensures the client keeps trying to reconnect when Redis comes back online
        logger.info("Redis reconnection using extended delay (30 seconds)");
        return 30000; // 30 second delay for persistent reconnection attempts
      },
    },
  });

  client.on("error", (err) => {
    logger.error("Redis client error:", err);
  });

  client.on("connect", () => {
    logger.info("Redis client connected");
  });

  client.on("reconnecting", () => {
    logger.info("Redis client reconnecting");
  });

  client.on("ready", () => {
    logger.info("Redis client ready");
  });

  client.on("end", () => {
    logger.info("Redis client disconnected");
  });

  return client as RedisClient;
}

/**
 * Creates a cache service instance with the provided or environment Redis client
 * @param redis - Optional Redis client. If not provided, creates one from environment
 * @returns Promise that resolves to a CacheService instance
 */
export async function createCacheService(redis?: RedisClient): Promise<{ client: RedisClient }> {
  const client = redis ?? createRedisClientFromEnv();

  if (!client.isOpen) {
    // Connect immediately and handle initial connection failures
    try {
      await client.connect();
    } catch (err) {
      logger.error("Initial Redis connection failed:", err);
      throw err;
    }
  }

  return {
    client,
  };
}
