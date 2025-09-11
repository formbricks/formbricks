import type { RedisClient } from "@/types/client";
import { type CacheError, CacheErrorClass, ErrorCode, type Result, err, ok } from "@/types/error";
import type { CacheKey } from "@/types/keys";
import { ZCacheKey } from "@/types/keys";
import { ZTtlMs } from "@/types/service";
import { logger } from "@formbricks/logger";
import { validateInputs } from "./utils/validation";

/**
 * Core cache service providing basic Redis operations with JSON serialization
 */
export class CacheService {
  constructor(private readonly redis: RedisClient) {}

  /**
   * Wraps Redis operations with connection check and timeout to prevent hanging
   */
  private async withTimeout<T>(operation: Promise<T>, timeoutMs = 1000): Promise<T> {
    return Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new CacheErrorClass(ErrorCode.RedisOperationError, "Cache operation timeout"));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Get the underlying Redis client for advanced operations (e.g., Lua scripts)
   * Use with caution - prefer cache service methods when possible
   * @returns The Redis client instance or null if not ready
   */
  getRedisClient(): RedisClient | null {
    if (!this.isRedisAvailable()) {
      return null;
    }
    return this.redis;
  }

  /**
   * Get a value from cache with automatic JSON deserialization
   * @param key - Cache key to retrieve
   * @returns Result containing parsed value, null if not found, or an error
   */
  async get<T>(key: CacheKey): Promise<Result<T | null, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisAvailable()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    const validation = validateInputs([key, ZCacheKey]);
    if (!validation.ok) {
      return validation;
    }

    try {
      const value = await this.withTimeout(this.redis.get(key));
      if (value === null) {
        return ok(null);
      }

      // Parse JSON - all data should be valid JSON since we stringify on set
      try {
        return ok(JSON.parse(value) as T);
      } catch (parseError) {
        // JSON parse failure indicates corrupted cache data - treat as cache miss
        logger.warn("Corrupted cache data detected, treating as cache miss", {
          key,
          parseError,
        });
        return err({
          code: ErrorCode.CacheCorruptionError,
        });
      }
    } catch (error) {
      logger.error({ error, key }, "Cache get operation failed");
      return err({
        code: ErrorCode.RedisOperationError,
      });
    }
  }

  /**
   * Check if a key exists in cache (for distinguishing cache miss from cached null)
   * @param key - Cache key to check
   * @returns Result containing boolean indicating if key exists
   */
  async exists(key: CacheKey): Promise<Result<boolean, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisAvailable()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    const validation = validateInputs([key, ZCacheKey]);
    if (!validation.ok) {
      return validation;
    }

    try {
      const exists = await this.withTimeout(this.redis.exists(key));
      return ok(exists > 0);
    } catch (error) {
      logger.error({ error, key }, "Cache exists operation failed");
      return err({
        code: ErrorCode.RedisOperationError,
      });
    }
  }

  /**
   * Set a value in cache with automatic JSON serialization and TTL
   * @param key - Cache key to store under
   * @param value - Value to store
   * @param ttlMs - Time to live in milliseconds
   * @returns Result containing void or an error
   */
  async set(key: CacheKey, value: unknown, ttlMs: number): Promise<Result<void, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisAvailable()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    // Validate both key and TTL in one call
    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Normalize undefined to null to maintain consistent cached-null semantics
      const normalizedValue = value === undefined ? null : value;
      const serialized = JSON.stringify(normalizedValue);

      await this.withTimeout(this.redis.setEx(key, Math.floor(ttlMs / 1000), serialized));
      return ok(undefined);
    } catch (error) {
      logger.error({ error, key, ttlMs }, "Cache set operation failed");
      return err({
        code: ErrorCode.RedisOperationError,
      });
    }
  }

  /**
   * Delete one or more keys from cache (idempotent)
   * @param keys - Array of keys to delete
   * @returns Result containing void or an error
   */
  async del(keys: CacheKey[]): Promise<Result<void, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisAvailable()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    // Validate all keys using generic validation
    for (const key of keys) {
      const validation = validateInputs([key, ZCacheKey]);
      if (!validation.ok) {
        return validation;
      }
    }

    try {
      if (keys.length > 0) {
        await this.withTimeout(this.redis.del(keys));
      }
      return ok(undefined);
    } catch (error) {
      logger.error({ error, keys }, "Cache delete operation failed");
      return err({
        code: ErrorCode.RedisOperationError,
      });
    }
  }

  /**
   * Cache wrapper for functions (cache-aside).
   * Never throws due to cache errors; function errors propagate without retry.
   * Must include null in T to support cached null values.
   * @param fn - Function to execute (and optionally cache).
   * @param key - Cache key
   * @param ttlMs - Time to live in milliseconds
   * @returns Cached value if present, otherwise fresh result from fn()
   */
  async withCache<T>(fn: () => Promise<T>, key: CacheKey, ttlMs: number): Promise<T> {
    if (!this.isRedisAvailable()) {
      return await fn();
    }

    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      logger.warn({ error: validation.error, key }, "Invalid cache inputs, executing function directly");
      return await fn();
    }

    const cachedValue = await this.tryGetCachedValue<T>(key, ttlMs);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const fresh = await fn();
    await this.trySetCache(key, fresh, ttlMs);
    return fresh;
  }

  private async tryGetCachedValue<T>(key: CacheKey, ttlMs: number): Promise<T | undefined> {
    try {
      const cacheResult = await this.get<T>(key);
      if (cacheResult.ok && cacheResult.data !== null) {
        return cacheResult.data;
      }

      if (cacheResult.ok && cacheResult.data === null) {
        const existsResult = await this.exists(key);
        if (existsResult.ok && existsResult.data) {
          return null as T;
        }
      }

      if (!cacheResult.ok) {
        logger.debug(
          { error: cacheResult.error, key, ttlMs },
          "Cache get operation failed, fetching fresh data"
        );
      }
    } catch (error) {
      logger.debug({ error, key, ttlMs }, "Cache get/exists threw; proceeding to compute fresh value");
    }

    return undefined;
  }

  private async trySetCache(key: CacheKey, value: unknown, ttlMs: number): Promise<void> {
    if (typeof value === "undefined") {
      return; // Skip caching undefined values
    }

    try {
      const setResult = await this.set(key, value, ttlMs);
      if (!setResult.ok) {
        logger.debug(
          { error: setResult.error, key, ttlMs },
          "Failed to cache fresh data, but returning result"
        );
      }
    } catch (error) {
      logger.debug({ error, key, ttlMs }, "Cache set threw; returning fresh result");
    }
  }

  private isRedisAvailable(): boolean {
    return this.redis.isReady && this.redis.isOpen;
  }
}
