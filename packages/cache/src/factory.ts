import type { RedisClient } from "@/types/client";
import { type CacheError, CacheErrorClass, ErrorCode, type Result, err, ok } from "@/types/error";
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
 * Creates a cache service instance and connects to Redis.
 * Returns a Result and never throws; callers must handle \{ ok: false \}.
 * Singleton scope: per-process/per-module instance (each worker/lambda gets its own).
 * Each package using Redis should handle its own connection
 * This is a singleton to ensure only one instance of the cache service is created
 * @returns Promise that resolves to Result containing CacheService or CacheError
 */
let singleton: CacheService | null = null;
let initializing: Promise<CacheService> | null = null;

export async function createCacheService(): Promise<Result<CacheService, CacheError>> {
  if (singleton) return ok(singleton);
  if (initializing) {
    // return the result of the first initializing promise if it exists
    try {
      const svc = await initializing;
      return ok(svc);
    } catch (e) {
      return err(e as CacheError);
    }
  }

  initializing = (async () => {
    const clientResult = createRedisClientFromEnv();
    if (!clientResult.ok) {
      throw CacheErrorClass.fromCacheError(clientResult.error, "Redis client creation failed");
    }
    const client = clientResult.data;
    if (!client.isOpen) {
      try {
        await client.connect();
      } catch (error) {
        logger.error(error, "Redis connection failed");
        // Prevent zombie reconnect loops by destroying the failed client
        try {
          client.destroy();
        } catch {
          // Ignore cleanup errors - the original connection error is more important
        }
        throw new CacheErrorClass(ErrorCode.RedisConnectionError, "Redis connection failed");
      }
    }
    const svc = new CacheService(client);
    singleton = svc;
    return svc;
  })();

  // handles the first initializing promise
  try {
    const svc = await initializing;
    return ok(svc);
  } catch (e) {
    initializing = null; // allow retry on next call
    return err(e as CacheError);
  }
}

// Test-only reset; do not export from the package entrypoint.
export function __resetCacheFactoryForTests(): void {
  singleton = null;
  initializing = null;
}
