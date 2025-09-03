import type { RedisClient } from "@/types/client";
import { type CacheError, CacheErrorClass, ErrorCode, type Result, err, ok } from "@/types/error";
import { createClient } from "redis";
import { logger } from "@formbricks/logger";
import { CacheService } from "./service";

// Re-export CacheService for consumers
export { CacheService } from "./service";

/**
 * Creates a Redis client from the REDIS_URL environment variable
 * @returns Result containing RedisClient or RedisConfigurationError if REDIS_URL is not set
 */
export async function createRedisClientFromEnv(): Promise<Result<RedisClient, CacheError>> {
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
      connectTimeout: 3000,
    },
  });

  client.on("error", (error) => {
    logger.error(error, "Redis client error");
    try {
      resetCacheFactory();
      client.destroy();
    } catch (e) {
      logger.error(e, "Error destroying Redis client");
    }
  });

  client.on("connect", () => {
    logger.info("Redis client connected");
  });

  client.on("ready", () => {
    logger.info("Redis client ready");
  });

  client.on("end", () => {
    logger.info("Redis client disconnected");
  });

  await client.connect();

  return ok(client as RedisClient);
}

// Global singleton with globalThis for cross-module sharing
const globalForCache = globalThis as unknown as {
  formbricksCache: CacheService | undefined;
  formbricksCacheInitializing: Promise<CacheService> | undefined;
};

// Module-level singleton for performance
let singleton: CacheService | null = globalForCache.formbricksCache ?? null;

/**
 * Returns existing instance immediately if available
 * Creates a cache service instance instead if not available
 * Fails fast if Redis is not available - consumers handle reconnection
 */
export async function getCacheService(): Promise<Result<CacheService, CacheError>> {
  // Return existing instance immediately
  if (singleton && singleton.getRedisClient()?.isReady && singleton.getRedisClient()?.isOpen) {
    return ok(singleton);
  }

  // Return existing instance from globalForCache if available
  if (
    globalForCache.formbricksCache &&
    globalForCache.formbricksCache.getRedisClient()?.isReady &&
    globalForCache.formbricksCache.getRedisClient()?.isOpen
  ) {
    singleton = globalForCache.formbricksCache;
    return ok(singleton);
  }

  // Prevent concurrent initialization
  if (globalForCache.formbricksCacheInitializing) {
    try {
      const svc = await globalForCache.formbricksCacheInitializing;
      singleton = svc;
      return ok(svc);
    } catch (e) {
      return err(e as CacheError);
    }
  }

  // Start initialization - fail fast approach
  globalForCache.formbricksCacheInitializing = (async () => {
    const clientResult = await createRedisClientFromEnv();
    if (!clientResult.ok) {
      logger.error("Redis client creation failed", { error: clientResult.error });
      throw CacheErrorClass.fromCacheError(clientResult.error, "Redis client creation failed");
    }

    const client = clientResult.data;
    logger.debug("Redis connection established", { client });
    const svc = new CacheService(client);
    singleton = svc;
    globalForCache.formbricksCache = svc;
    logger.debug("Cache service created", { svc });
    return svc;
  })();

  try {
    const svc = await globalForCache.formbricksCacheInitializing;
    return ok(svc);
  } catch (e) {
    globalForCache.formbricksCacheInitializing = undefined; // Allow retry
    logger.error("Cache service creation failed", { error: e });
    return err(e as CacheError);
  }
}

export function resetCacheFactory(): void {
  singleton = null;
  globalForCache.formbricksCache = undefined;
  globalForCache.formbricksCacheInitializing = undefined;
}
