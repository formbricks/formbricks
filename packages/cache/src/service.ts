import { logger } from "@formbricks/logger";
import type { CacheKey } from "../types/keys";
import { ZCacheKey, ZTtlMs, validateInputs } from "../types/service";
import type { RedisClient } from "./factory";

/**
 * Core cache service providing basic Redis operations with JSON serialization
 */
export class CacheService {
  constructor(private readonly redis: RedisClient) {}

  /**
   * Get a value from cache with automatic JSON deserialization
   * @param key - Cache key to retrieve
   * @returns Parsed value or null if not found
   */
  async get<T>(key: CacheKey): Promise<T | null> {
    validateInputs([key, ZCacheKey]);

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }

      // Parse JSON - all data should be valid JSON since we stringify on set
      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        // JSON parse failure indicates corrupted cache data - treat as cache miss
        logger.warn("Corrupted cache data detected, treating as cache miss", {
          key,
          parseError,
        });
        return null;
      }
    } catch (error) {
      logger.error("Cache get operation failed", { key, error });
      throw error;
    }
  }

  /**
   * Set a value in cache with automatic JSON serialization and TTL
   * @param key - Cache key to store under
   * @param value - Value to store
   * @param ttlMs - Time to live in milliseconds
   */
  async set(key: CacheKey, value: unknown, ttlMs: number): Promise<void> {
    validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setEx(key, Math.floor(ttlMs / 1000), serialized);
    } catch (error) {
      logger.error("Cache set operation failed", { key, ttlMs, error });
      throw error;
    }
  }

  /**
   * Delete one or more keys from cache (idempotent)
   * @param keys - Single key or array of keys to delete
   */
  async del(keys: CacheKey | CacheKey[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Validate all keys
    keyArray.forEach((key) => validateInputs([key, ZCacheKey]));

    try {
      if (keyArray.length > 0) {
        // eslint-disable-next-line prefer-spread -- we can only use spread if we cast to any before
        await this.redis.del.apply(this.redis, keyArray);
      }
    } catch (error) {
      logger.error("Cache delete operation failed", { keys: keyArray, error });
      throw error;
    }
  }

  /**
   * Cache wrapper for functions - implements cache-aside pattern
   * @param fn - Function to cache
   * @param key - Cache key
   * @param ttlMs - Time to live in milliseconds
   * @returns Cached result or fresh result from function
   */
  async withCache<T>(fn: () => Promise<T>, key: CacheKey, ttlMs: number): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - execute function
      const fresh = await fn();

      // Store in cache for next time
      await this.set(key, fresh, ttlMs);

      return fresh;
    } catch (cacheError) {
      // On cache error, still try to fetch fresh data
      logger.warn("Cache operation failed, fetching fresh data", { key, error: cacheError });

      try {
        return await fn();
      } catch (fnError) {
        logger.error("Failed to fetch fresh data after cache error", {
          key,
          cacheError,
          functionError: fnError,
        });
        throw fnError;
      }
    }
  }
}
