import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import type { RedisClient } from "../types/client";
import { ErrorCode } from "../types/error";
import type { CacheKey } from "../types/keys";
import { CacheService } from "./service";

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

interface MockRedisClient {
  get: ReturnType<typeof vi.fn>;
  setEx: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  isReady: boolean;
  isOpen: boolean;
}

describe("CacheService", () => {
  let mockRedis: MockRedisClient;
  let cacheService: CacheService;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      setEx: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      ping: vi.fn().mockResolvedValue("PONG"),
      isReady: true,
      isOpen: true,
    };
    cacheService = new CacheService(mockRedis as unknown as RedisClient);
  });

  describe("get", () => {
    test("should return parsed JSON value when found", async () => {
      const key = "test:key" as CacheKey;
      const value = { data: "test" };
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(value);
      }
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    test("should return null when key not found", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    test("should return error when JSON parse fails (corrupted data)", async () => {
      const key = "test:key" as CacheKey;
      const corruptedValue = "invalid json {broken";
      mockRedis.get.mockResolvedValue(corruptedValue);

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheCorruptionError);
      }
      expect(logger.warn).toHaveBeenCalledWith(
        "Corrupted cache data detected, treating as cache miss",
        expect.objectContaining({
          key,
          parseError: expect.objectContaining({
            name: "SyntaxError",
            message: expect.stringContaining("JSON") as string,
          }) as Error,
        })
      );
    });

    test("should return validation error for empty key", async () => {
      const key = "" as CacheKey;

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return validation error for whitespace-only key", async () => {
      const key = "   " as CacheKey;

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return error when Redis operation fails", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisOperationError);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), key }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- Testing error handling with any Error type
        "Cache get operation failed"
      );
    });

    test("should handle string values correctly", async () => {
      const key = "test:key" as CacheKey;
      const value = "simple string";
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(value);
      }
    });

    test("should handle number values correctly", async () => {
      const key = "test:key" as CacheKey;
      const value = 42;
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(value);
      }
    });

    test("should handle boolean values correctly", async () => {
      const key = "test:key" as CacheKey;
      const value = false;
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(value);
      }
    });

    test("should handle nested object values correctly", async () => {
      const key = "test:key" as CacheKey;
      const value = { nested: { deeply: { value: "test" } }, array: [1, 2, 3] };
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(value);
      }
    });
  });

  describe("exists", () => {
    test("should return true when key exists", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockRedis.exists).toHaveBeenCalledWith(key);
    });

    test("should return false when key does not exist", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.exists(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    test("should return validation error for empty key", async () => {
      const key = "" as CacheKey;

      const result = await cacheService.exists(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return error when Redis operation fails", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.exists.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.exists(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisOperationError);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), key }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- Testing error handling with any Error type
        "Cache exists operation failed"
      );
    });

    test("should handle multiple keys existing", async () => {
      const key = "test:key" as CacheKey;
      mockRedis.exists.mockResolvedValue(2); // Multiple keys exist

      const result = await cacheService.exists(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
    });
  });

  describe("set", () => {
    test("should store JSON serialized value with TTL", async () => {
      const key = "test:key" as CacheKey;
      const value = { data: "test" };
      const ttlMs = 60000;

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
    });

    test("should convert TTL from milliseconds to seconds", async () => {
      const key = "test:key" as CacheKey;
      const value = "test";
      const ttlMs = 5500; // 5.5 seconds

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 5, JSON.stringify(value));
    });

    test("should normalize undefined to null and store as JSON", async () => {
      const key = "test:key" as CacheKey;
      const value = undefined;
      const ttlMs = 60000;

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, "null");
    });

    test("should store null values as JSON", async () => {
      const key = "test:key" as CacheKey;
      const value = null;
      const ttlMs = 60000;

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, "null");
    });

    test("should return validation error for invalid TTL", async () => {
      const key = "test:key" as CacheKey;
      const value = "test";

      const result1 = await cacheService.set(key, value, 0);
      const result2 = await cacheService.set(key, value, -1);
      const result3 = await cacheService.set(key, value, 500); // Below 1000ms minimum

      expect(result1.ok).toBe(false);
      expect(result2.ok).toBe(false);
      expect(result3.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return validation error for empty key", async () => {
      const key = "" as CacheKey;
      const value = "test";

      const result = await cacheService.set(key, value, 1000);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return error when Redis operation fails", async () => {
      const key = "test:key" as CacheKey;
      const value = "test";
      const ttlMs = 60000;
      mockRedis.setEx.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisOperationError);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), key, ttlMs }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- Testing error handling with any Error type
        "Cache set operation failed"
      );
    });

    test("should handle complex data types correctly", async () => {
      const key = "test:key" as CacheKey;
      const value = {
        string: "test",
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { level: { deep: "value" } },
        nullValue: null,
      };
      const ttlMs = 60000;

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
    });
  });

  describe("del", () => {
    test("should delete single key", async () => {
      const key = "test:key" as CacheKey;

      const result = await cacheService.del([key]);

      expect(result.ok).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith([key]);
    });

    test("should delete multiple keys", async () => {
      const keys = ["test:key1", "test:key2"] as CacheKey[];

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(keys);
    });

    test("should be idempotent (not throw if key missing)", async () => {
      const key = "nonexistent:key" as CacheKey;
      mockRedis.del.mockResolvedValue(0);

      const result = await cacheService.del([key]);

      expect(result.ok).toBe(true);
    });

    test("should handle empty array gracefully", async () => {
      const result = await cacheService.del([]);

      expect(result.ok).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test("should return validation error for empty key in array", async () => {
      const keys = ["valid:key", ""] as CacheKey[];

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return error when Redis is not ready/open", async () => {
      const keys = ["test:key1", "test:key2"] as CacheKey[];
      mockRedis.isReady = false;
      mockRedis.isOpen = false;

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
      }
    });

    test("should return error when Redis operation fails", async () => {
      const keys = ["test:key1", "test:key2"] as CacheKey[];
      mockRedis.del.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisOperationError);
      }
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), keys }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- Testing error handling with any Error type
        "Cache delete operation failed"
      );
    });

    test("should validate all keys before deletion", async () => {
      const keys = ["valid:key1", "   ", "valid:key2"] as CacheKey[];

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("getRedisClient", () => {
    test("should return the Redis client instance when ready", () => {
      const result = cacheService.getRedisClient();

      expect(result).toBe(mockRedis);
    });

    test("should return null when Redis is not ready", () => {
      mockRedis.isReady = false;

      const result = cacheService.getRedisClient();

      expect(result).toBeNull();
    });

    test("should return null when Redis is not open", () => {
      mockRedis.isOpen = false;

      const result = cacheService.getRedisClient();

      expect(result).toBeNull();
    });
  });

  describe("isRedisAvailable", () => {
    test("should return true when Redis is ready, open, and ping succeeds", async () => {
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await cacheService.isRedisAvailable();

      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalledOnce();
    });

    test("should return false when Redis is not ready", async () => {
      mockRedis.isReady = false;
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await cacheService.isRedisAvailable();

      expect(result).toBe(false);
      expect(mockRedis.ping).not.toHaveBeenCalled();
    });

    test("should return false when Redis is not open", async () => {
      mockRedis.isOpen = false;
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await cacheService.isRedisAvailable();

      expect(result).toBe(false);
      expect(mockRedis.ping).not.toHaveBeenCalled();
    });

    test("should return false when Redis ping fails", async () => {
      mockRedis.ping.mockRejectedValue(new Error("Connection lost"));

      const result = await cacheService.isRedisAvailable();

      expect(result).toBe(false);
      expect(mockRedis.ping).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith(
        { error: expect.any(Error) }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- Testing error handling with any Error type
        "Redis ping failed during availability check"
      );
    });

    test("should return false when ping times out", async () => {
      // Mock ping to hang indefinitely
      const hangingPromise = new Promise(() => {
        // This promise never resolves to simulate timeout
      });
      mockRedis.ping.mockImplementation(() => hangingPromise);

      const result = await cacheService.isRedisAvailable();

      expect(result).toBe(false);
      expect(mockRedis.ping).toHaveBeenCalledOnce();
    });

    test("should handle different ping responses correctly", async () => {
      // Test with standard PONG response
      mockRedis.ping.mockResolvedValue("PONG");
      let result = await cacheService.isRedisAvailable();
      expect(result).toBe(true);

      // Test with custom ping message
      mockRedis.ping.mockResolvedValue("custom-message");
      result = await cacheService.isRedisAvailable();
      expect(result).toBe(true);

      // Test with empty response (still success if no error thrown)
      mockRedis.ping.mockResolvedValue("");
      result = await cacheService.isRedisAvailable();
      expect(result).toBe(true);
    });

    test("should be async and return Promise<boolean>", async () => {
      mockRedis.ping.mockResolvedValue("PONG");

      const result = cacheService.isRedisAvailable();

      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(true);
    });
  });

  describe("withCache", () => {
    test("should return cached value when available", async () => {
      const key = "test:key" as CacheKey;
      const cachedValue = { data: "cached" };
      const fn = vi.fn().mockResolvedValue({ data: "fresh" });

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
    });

    test("should compute and cache value when cache miss", async () => {
      const key = "test:key" as CacheKey;
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0); // Key doesn't exist

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(freshValue);
      expect(fn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(freshValue));
    });

    test("should return fresh value when cache operation fails", async () => {
      const key = "test:key" as CacheKey;
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(freshValue);
      expect(fn).toHaveBeenCalledOnce();
    });

    test("should return cached null value without executing function", async () => {
      const key = "test:key" as CacheKey;
      const fn = vi.fn().mockResolvedValue({ data: "fresh" });

      // Mock Redis returning stringified null (cached null value)
      mockRedis.get.mockResolvedValue("null");
      mockRedis.exists.mockResolvedValue(1); // Key exists

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled(); // Function should not be executed
    });

    test("should execute function and cache null result", async () => {
      const key = "test:key" as CacheKey;
      const fn = vi.fn().mockResolvedValue(null); // Function returns null

      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0); // Key doesn't exist

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, "null");
    });

    test("should return undefined without caching when function returns undefined", async () => {
      const key = "test:key" as CacheKey;
      const fn = vi.fn().mockResolvedValue(undefined); // Function returns undefined

      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0); // Key doesn't exist

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalledOnce();
      // undefined should NOT be cached to preserve semantics
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    test("should distinguish between null and undefined return values", async () => {
      const nullKey = "test:null-key" as CacheKey;
      const undefinedKey = "test:undefined-key" as CacheKey;

      const nullFn = vi.fn().mockResolvedValue(null);
      const undefinedFn = vi.fn().mockResolvedValue(undefined);

      // Mock cache miss for both keys
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0);

      // Test null return value - should be cached
      const nullResult = await cacheService.withCache(nullFn, nullKey, 60000);
      expect(nullResult).toBeNull();
      expect(nullFn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).toHaveBeenCalledWith(nullKey, 60, "null");

      // Reset mocks
      vi.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0);

      // Test undefined return value - should NOT be cached
      const undefinedResult = await cacheService.withCache(undefinedFn, undefinedKey, 60000);
      expect(undefinedResult).toBeUndefined();
      expect(undefinedFn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    test("should execute function directly when cache fails", async () => {
      const key = "test:key" as CacheKey;
      const expectedResult = { data: "result" };
      const fn = vi.fn().mockResolvedValue(expectedResult);

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.withCache(fn, key, 60000);

      // withCache now always returns the function result, even when cache fails
      expect(result).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledOnce();
    });

    test("should execute function directly when validation fails", async () => {
      const invalidKey = "" as CacheKey; // Empty key should fail validation
      const expectedResult = { data: "result" };
      const fn = vi.fn().mockResolvedValue(expectedResult);

      const result = await cacheService.withCache(fn, invalidKey, 60000);

      expect(result).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledOnce();
      // Should not attempt any cache operations when validation fails
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    test("should execute function directly when TTL validation fails", async () => {
      const key = "test:key" as CacheKey;
      const invalidTtl = 500; // Below minimum TTL of 1000ms
      const expectedResult = { data: "result" };
      const fn = vi.fn().mockResolvedValue(expectedResult);

      const result = await cacheService.withCache(fn, key, invalidTtl);

      expect(result).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledOnce();
      // Should not attempt any cache operations when validation fails
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });
  });
});
