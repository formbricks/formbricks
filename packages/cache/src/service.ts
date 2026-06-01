import { logger } from "@formbricks/logger";
import type { RedisClient } from "@/types/client";
import { type CacheError, CacheErrorClass, ErrorCode, type Result, err, ok } from "@/types/error";
import type { CacheKey } from "@/types/keys";
import { ZCacheKey } from "@/types/keys";
import { ZTtlMs, ZTtlMsOptional } from "@/types/service";
import { validateInputs } from "./utils/validation";

/** Marker for the nullable cache wire format. */
const NULLABLE_BOX_MARKER = "__fb_nullable_v1";

interface NullableCacheBox<T> {
  [NULLABLE_BOX_MARKER]: true;
  value: T | null;
}

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
    if (!this.isRedisClientReady()) {
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
    if (!this.isRedisClientReady()) {
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
        logger.warn(
          {
            key,
            parseError,
          },
          "Corrupted cache data detected, treating as cache miss"
        );
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
   * Check if a key exists in cache.
   * Prefer single-GET cache-aside semantics in withCache to avoid TOCTOU races.
   * @param key - Cache key to check
   * @returns Result containing boolean indicating if key exists
   */
  async exists(key: CacheKey): Promise<Result<boolean, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisClientReady()) {
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
   * Set a value in cache with automatic JSON serialization and optional TTL
   * @param key - Cache key to store under
   * @param value - Value to store
   * @param ttlMs - Time to live in milliseconds (optional - if omitted, key persists indefinitely)
   * @returns Result containing void or an error
   */
  async set(key: CacheKey, value: unknown, ttlMs?: number): Promise<Result<void, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisClientReady()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    // Validate key and optional TTL
    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMsOptional]);
    if (!validation.ok) {
      return validation;
    }

    // Undefined is a caller bug, not a cacheable null.
    if (value === undefined) {
      logger.warn({ key, ttlMs }, "cache.set called with undefined; skipping write");
      return ok(undefined);
    }

    try {
      const serialized = JSON.stringify(value);

      if (ttlMs === undefined) {
        // Set without expiration (persists indefinitely)
        await this.withTimeout(this.redis.set(key, serialized));
      } else {
        // Set with expiration
        await this.withTimeout(this.redis.setEx(key, Math.floor(ttlMs / 1000), serialized));
      }
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
    if (!this.isRedisClientReady()) {
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
   * Try to acquire a distributed lock (atomic SET NX operation)
   * @param key - Lock key
   * @param value - Lock value (typically "locked" or instance identifier)
   * @param ttlMs - Time to live in milliseconds (lock expiration)
   * @returns Result containing boolean indicating if lock was acquired, or an error
   */
  async tryLock(key: CacheKey, value: string, ttlMs: number): Promise<Result<boolean, CacheError>> {
    // Check Redis availability first
    if (!this.isRedisClientReady()) {
      return err({
        code: ErrorCode.RedisConnectionError,
      });
    }

    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Use SET with NX (only set if not exists) and PX (expiration in milliseconds) for atomic lock acquisition
      const result = await this.withTimeout(
        this.redis.set(key, value, {
          NX: true,
          PX: ttlMs,
        })
      );
      // SET returns "OK" if lock was acquired, null if key already exists
      return ok(result === "OK");
    } catch (error) {
      logger.error({ error, key, ttlMs }, "Cache lock operation failed");
      return err({
        code: ErrorCode.RedisOperationError,
      });
    }
  }

  /**
   * Cache wrapper for functions (cache-aside).
   *
   * Bare JSON null is treated as a miss; use withCacheNullable for intentional null values.
   * Never throws due to cache errors; function errors propagate without retry.
   *
   * @param fn - Function to execute (and optionally cache).
   * @param key - Cache key
   * @param ttlMs - Time to live in milliseconds
   * @returns Cached value if present, otherwise fresh result from fn()
   */
  async withCache<T extends NonNullable<unknown>>(
    fn: () => Promise<T>,
    key: CacheKey,
    ttlMs: number
  ): Promise<T> {
    if (!this.canUseCache(key, ttlMs)) {
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

  /**
   * Cache wrapper for functions whose result may legitimately be `null`.
   *
   * Stores results in a marked envelope so cached nulls are distinct from misses.
   *
   * @param fn - Function to execute (and optionally cache); may return null.
   * @param key - Cache key
   * @param ttlMs - Time to live in milliseconds
   * @returns Cached value if present (including a cached `null`), otherwise fresh result from fn()
   */
  async withCacheNullable<T extends NonNullable<unknown>>(
    fn: () => Promise<T | null>,
    key: CacheKey,
    ttlMs: number
  ): Promise<T | null> {
    if (!this.canUseCache(key, ttlMs)) {
      return await fn();
    }

    const cachedValue = await this.tryGetCachedValue<unknown>(key, ttlMs);
    if (cachedValue !== undefined) {
      if (this.isNullableCacheBox<T>(cachedValue)) {
        return cachedValue.value;
      }

      logger.debug(
        { key, ttlMs },
        "Nullable cache entry is missing marker or value field; treating as cache miss and refreshing"
      );
    }

    const fresh = await fn();
    // Guard against type-erased callers resolving undefined.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- types exclude undefined; this guards against type-erasure bugs
    if (fresh !== undefined) {
      const box: NullableCacheBox<T> = { [NULLABLE_BOX_MARKER]: true, value: fresh };
      await this.trySetCache(key, box, ttlMs);
    }
    return fresh;
  }

  /** Returns false when callers should bypass cache and execute directly. */
  private canUseCache(key: CacheKey, ttlMs: number): boolean {
    if (!this.isRedisClientReady()) {
      return false;
    }

    const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
    if (!validation.ok) {
      logger.warn({ error: validation.error, key }, "Invalid cache inputs, executing function directly");
      return false;
    }

    return true;
  }

  private isNullableCacheBox<T>(value: unknown): value is NullableCacheBox<T> {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as Record<string, unknown>)[NULLABLE_BOX_MARKER] === true &&
      Object.hasOwn(value, "value")
    );
  }

  private async tryGetCachedValue<T>(key: CacheKey, ttlMs: number): Promise<T | undefined> {
    try {
      const cacheResult = await this.get<T>(key);
      if (cacheResult.ok && cacheResult.data !== null) {
        return cacheResult.data;
      }

      if (!cacheResult.ok) {
        logger.debug(
          { error: cacheResult.error, key, ttlMs },
          "Cache get operation failed, fetching fresh data"
        );
      }
    } catch (error) {
      logger.debug({ error, key, ttlMs }, "Cache get threw; proceeding to compute fresh value");
    }

    return undefined;
  }

  private async trySetCache(key: CacheKey, value: unknown, ttlMs: number): Promise<void> {
    // Never persist null/undefined. The read path (tryGetCachedValue) treats a
    // stored JSON `null` as a cache miss, so writing one is not just useless —
    // it causes a recompute-and-rewrite loop on every request for a hot key.
    // This also hardens withCache against a `null` slipping past its
    // `NonNullable<T>` constraint via type erasure (unknown/any plumbing, casts),
    // which is the exact class of bug this change set fixes. withCacheNullable is
    // unaffected: it always writes a non-null boxed envelope, never raw null.
    if (value === undefined || value === null) {
      logger.debug({ key, ttlMs }, "Refusing to cache nullish value; treating as non-cacheable");
      return;
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

  /**
   * Check if Redis is available and healthy by testing connectivity with ping
   * @returns Promise<boolean> indicating if Redis is available and responsive
   */
  async isRedisAvailable(): Promise<boolean> {
    if (!this.isRedisClientReady()) {
      return false;
    }

    try {
      await this.withTimeout(this.redis.ping());
      return true;
    } catch (error) {
      logger.debug({ error }, "Redis ping failed during availability check");
      return false;
    }
  }

  /**
   * Fast synchronous check of Redis client state for internal use
   * @returns Boolean indicating if Redis client is ready and connected
   */
  private isRedisClientReady(): boolean {
    return this.redis.isReady && this.redis.isOpen;
  }
}
