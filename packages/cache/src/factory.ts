import type { RedisClient } from "@/types/client";
import { type CacheError, ErrorCode, type Result, err, ok } from "@/types/error";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";
import { CacheService } from "./service";

/**
 * Creates a Redis client from the REDIS_URL environment variable
 * @returns Result containing RedisClient or RedisConfigurationError if REDIS_URL is not set
 */
export function createRedisClientFromEnv(): Result<RedisClient, CacheError> {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.error("REDIS_URL is required to create the Redis client");
    return err({
      code: ErrorCode.RedisConfigurationError,
    });
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

  client.on("error", (error) => {
    logger.error(error, "Redis client error");
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

  return ok(client as RedisClient);
}

/**
 * Creates a cache service instance and connects to Redis
 * Each package using Redis should handle its own connection
 * @returns Promise that resolves to Result containing CacheService or CacheError
 */
export async function createCacheService(): Promise<Result<CacheService, CacheError>> {
  const clientResult = createRedisClientFromEnv();
  if (!clientResult.ok) {
    return clientResult;
  }

  const client = clientResult.data;

  // Connect to Redis
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (error) {
      logger.error(error, "Redis connection failed");
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }
  }

  return ok(new CacheService(client));
}
