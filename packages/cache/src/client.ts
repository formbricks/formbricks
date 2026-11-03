import { createClient } from "redis";
import { logger } from "@formbricks/logger";
import { getRedisTlsOptions } from "@formbricks/redis-config";
import type { RedisClient } from "@/types/client";
import { type CacheError, ErrorCode, type Result, err, ok } from "@/types/error";
import {
  beginCacheProbe,
  isCacheCircuitOpen,
  recordCacheFailure,
  recordCacheSuccess,
  resetCacheCircuit,
} from "./circuit";
import { REDIS_CONNECT_TIMEOUT_MS, withRedisDeadline } from "./deadline";
import { CacheService } from "./service";

const globalForCache = globalThis as unknown as {
  formbricksCache: CacheService | undefined;
  formbricksCacheInitializing: Promise<Result<CacheService, CacheError>> | undefined;
  formbricksCacheClient: RedisClient | undefined;
};

let singleton: CacheService | null = globalForCache.formbricksCache ?? null;

const resetCacheInstance = (): void => {
  singleton = null;
  globalForCache.formbricksCache = undefined;
  globalForCache.formbricksCacheInitializing = undefined;
};

const errorIdentity = (error: unknown): { name: string; code?: string } => {
  if (!(error instanceof Error)) return { name: typeof error };
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return { name: error.name, ...(code ? { code } : {}) };
};

const destroyErrorDetails = (error: unknown) => ({
  ...errorIdentity(error),
  ...(error instanceof AggregateError
    ? { causes: error.errors.slice(0, 3).map((cause: unknown) => errorIdentity(cause)) }
    : {}),
});

const destroyClient = (client: RedisClient): void => {
  try {
    void Promise.resolve(client.destroy()).catch((error: unknown) => {
      logger.error(destroyErrorDetails(error), "Error destroying Redis client");
    });
  } catch (error) {
    logger.error(destroyErrorDetails(error), "Error destroying Redis client");
  }
};

/** Discard a stalled connection, including commands that node-redis may still have queued. */
const discardClient = (client: RedisClient): void => {
  if (globalForCache.formbricksCacheClient !== client) return;
  globalForCache.formbricksCacheClient = undefined;
  recordCacheFailure();
  resetCacheInstance();
  destroyClient(client);
};

const discardUnreadyInstance = (): void => {
  const client = globalForCache.formbricksCacheClient;
  if (client) {
    discardClient(client);
  } else {
    // The shared client may already have been discarded; do not count another failure.
    singleton = null;
  }
};

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

  let tls: ReturnType<typeof getRedisTlsOptions>;
  try {
    tls = getRedisTlsOptions(url, process.env.REDIS_TLS_CA);
  } catch (error) {
    logger.error(error, "Invalid Redis TLS configuration");
    return err({ code: ErrorCode.RedisConfigurationError });
  }

  const client = createClient({
    url,
    socket: {
      ...(tls && { tls: true as const, ...tls }),
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1000,
    // Managed Redis services and their network paths can reap idle connections (for example,
    // Azure Cache for Redis documents a 10-minute idle timeout). Ping well inside that limit.
    pingInterval: 300_000,
  });
  globalForCache.formbricksCacheClient = client as RedisClient;

  client.on("error", (error) => {
    logger.error(error, "Redis client error");
    discardClient(client as RedisClient);
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

  try {
    await withRedisDeadline(client.connect(), REDIS_CONNECT_TIMEOUT_MS, () =>
      discardClient(client as RedisClient)
    );
    if (globalForCache.formbricksCacheClient !== client || !client.isReady) {
      return err({ code: ErrorCode.RedisConnectionError });
    }
    return ok(client as RedisClient);
  } catch (error) {
    logger.error(error, "Redis client connection failed");
    discardClient(client as RedisClient);
    return err({ code: ErrorCode.RedisConnectionError });
  }
}

/**
 * Returns existing instance immediately if available
 * Creates a cache service instance instead if not available
 * Fails fast if Redis is not available - consumers handle reconnection
 */
export async function getCacheService(): Promise<Result<CacheService, CacheError>> {
  if (isCacheCircuitOpen()) {
    return err({ code: ErrorCode.RedisConnectionError });
  }

  // Return existing instance immediately
  if (singleton) {
    const rc = singleton.getRedisClient();
    if (rc?.isReady && rc.isOpen) return ok(singleton);
  }

  // Return existing instance from globalForCache if available
  if (globalForCache.formbricksCache) {
    const rc = globalForCache.formbricksCache.getRedisClient();
    if (rc?.isReady && rc.isOpen) {
      singleton = globalForCache.formbricksCache;
      return ok(globalForCache.formbricksCache);
    }
  }

  // A formerly ready connection went away without an error event. Discard it
  // before a new request can open another socket or queue more commands.
  if (singleton || globalForCache.formbricksCache) {
    discardUnreadyInstance();
    return err({ code: ErrorCode.RedisConnectionError });
  }

  // Prevent concurrent initialization
  if (globalForCache.formbricksCacheInitializing) {
    const result = await globalForCache.formbricksCacheInitializing;
    if (result.ok) {
      singleton = result.data;
    }
    return result;
  }

  if (!beginCacheProbe()) {
    return err({ code: ErrorCode.RedisConnectionError });
  }

  const initializing = (async (): Promise<Result<CacheService, CacheError>> => {
    const clientResult = await createRedisClientFromEnv();
    if (!clientResult.ok) {
      // Configuration failures have no client error event to open the circuit.
      if (clientResult.error.code === ErrorCode.RedisConfigurationError) recordCacheFailure();
      logger.error({ error: clientResult.error }, "Redis client creation failed");
      return err({ code: clientResult.error.code });
    }

    const client = clientResult.data;
    if (globalForCache.formbricksCacheClient !== client || !client.isReady) {
      discardClient(client);
      return err({ code: ErrorCode.RedisConnectionError });
    }
    logger.debug("Redis connection established");
    const svc = new CacheService(client, () => discardClient(client));
    singleton = svc;
    globalForCache.formbricksCache = svc;
    recordCacheSuccess();
    logger.debug("Cache service created");
    return ok(svc);
  })();
  globalForCache.formbricksCacheInitializing = initializing;

  const result = await initializing;
  if (globalForCache.formbricksCacheInitializing === initializing) {
    globalForCache.formbricksCacheInitializing = undefined;
  }
  if (!result.ok) {
    logger.error({ error: result.error }, "Cache service creation failed");
  }
  return result;
}

export function resetCacheFactory(): void {
  const client = globalForCache.formbricksCacheClient;
  globalForCache.formbricksCacheClient = undefined;
  if (client?.isOpen) destroyClient(client);
  resetCacheInstance();
  resetCacheCircuit();
}
