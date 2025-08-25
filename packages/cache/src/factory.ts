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
 * Creates a cache service instance with the provided or environment Redis client
 * @param redis - Optional Redis client. If not provided, creates one from environment
 * @returns Promise that resolves to Result containing CacheService or CacheError
 */
export async function createCacheService(redis?: RedisClient): Promise<Result<CacheService, CacheError>> {
  let client: RedisClient;

  if (redis) {
    client = redis;
  } else {
    const clientResult = createRedisClientFromEnv();
    if (!clientResult.ok) {
      return clientResult; // Return the error from createRedisClientFromEnv
    }
    client = clientResult.data;
  }

  if (!client.isOpen) {
    // Connect immediately and handle initial connection failures
    try {
      await client.connect();
    } catch (error) {
      logger.error(error, "Initial Redis connection failed");
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }
  }

  return ok(new CacheService(client));
}
