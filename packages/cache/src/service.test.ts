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
  });

  describe("getRedisClient", () => {
    test("should return the Redis client instance", () => {
      const result = cacheService.getRedisClient();

      expect(result).toBe(mockRedis);
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

    test("should execute function and cache undefined result as null", async () => {
      const key = "test:key" as CacheKey;
      const fn = vi.fn().mockResolvedValue(undefined); // Function returns undefined

      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);
      mockRedis.exists.mockResolvedValue(0); // Key doesn't exist

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalledOnce();
      // undefined should be normalized to null in cache
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, "null");
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
