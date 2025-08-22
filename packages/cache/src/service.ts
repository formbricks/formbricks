import type { RedisClient } from "@/types/client";
import { type CacheError, ErrorCode, type Result, err, ok } from "@/types/error";
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
   * Get a value from cache with automatic JSON deserialization
   * @param key - Cache key to retrieve
   * @returns Result containing parsed value, null if not found, or an error
   */
  async get<T>(key: CacheKey): Promise<Result<T | null, CacheError>> {
    const validation = validateInputs([key, ZCacheKey]);
    if (!validation.ok) {
      return validation;
    }

    try {
      const value = await this.redis.get(key);
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
    const validation = validateInputs([key, ZCacheKey]);
    if (!validation.ok) {
      return validation;
    }

    try {
      const exists = await this.redis.exists(key);
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
    // Validate both key and TTL in one call
    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Normalize undefined to null to maintain consistent cached-null semantics
      const normalizedValue = value === undefined ? null : value;
      const serialized = JSON.stringify(normalizedValue);
      await this.redis.setEx(key, Math.floor(ttlMs / 1000), serialized);
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
    // Validate all keys using generic validation
    for (const key of keys) {
      const validation = validateInputs([key, ZCacheKey]);
      if (!validation.ok) {
        return validation;
      }
    }

    try {
      if (keys.length > 0) {
        await this.redis.del(keys);
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
   * Cache wrapper for functions - implements cache-aside pattern
   * @param fn - Function to cache
   * @param key - Cache key
   * @param ttlMs - Time to live in milliseconds
   * @returns Result containing cached result or fresh result from function
   */
  async withCache<T>(
    fn: () => Promise<T>,
    key: CacheKey,
    ttlMs: number
  ): Promise<Result<T | null, CacheError>> {
    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Try to get from cache first
      const cacheResult = await this.get<T>(key);
      if (!cacheResult.ok) {
        // Cache operation failed, try to get fresh data
        logger.debug({ error: cacheResult.error, key }, "Cache get operation failed, fetching fresh data");
      } else if (cacheResult.data !== null) {
        // Cache hit with non-null value
        return ok(cacheResult.data);
      } else {
        // Got null - could be cache miss or cached null, check if key exists
        const existsResult = await this.exists(key);
        if (existsResult.ok && existsResult.data) {
          // Key exists, so this is a cached null value
          return ok(null);
        } else if (!existsResult.ok) {
          // Exists check failed, log and continue to execute function
          logger.debug({ error: existsResult.error, key }, "Cache exists check failed, fetching fresh data");
        }
        // Key doesn't exist (cache miss) or exists check failed - continue to execute function
      }

      // Cache miss or cache error - execute function
      const fresh = await fn();

      // Try to store in cache for next time (don't fail if cache set fails)
      const setResult = await this.set(key, fresh, ttlMs);
      if (!setResult.ok) {
        logger.error({ error: setResult.error, key }, "Failed to cache fresh data, but returning result");
      }

      return ok(fresh);
    } catch (fnError) {
      logger.error({ error: fnError, key }, "Function execution failed");
      return err({
        code: ErrorCode.Unknown,
      });
    }
  }
}
