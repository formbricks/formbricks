import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import type { RedisClient } from "../types/client";
import { ErrorCode } from "../types/error";
import { asCacheKey } from "../types/keys";
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
}

describe("CacheService", () => {
  let mockRedis: MockRedisClient;
  let cacheService: CacheService;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      setEx: vi.fn(),
      del: vi.fn(),
    };
    cacheService = new CacheService(mockRedis as unknown as RedisClient);
  });

  describe("get", () => {
    test("should return parsed JSON value when found", async () => {
      const key = asCacheKey("test:key");
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
      const key = asCacheKey("test:key");
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    test("should return error when JSON parse fails (corrupted data)", async () => {
      const key = asCacheKey("test:key");
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
      const key = asCacheKey("");

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return validation error for whitespace-only key", async () => {
      const key = asCacheKey("   ");

      const result = await cacheService.get(key);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });
  });

  describe("set", () => {
    test("should store JSON serialized value with TTL", async () => {
      const key = asCacheKey("test:key");
      const value = { data: "test" };
      const ttlMs = 60000;

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
    });

    test("should convert TTL from milliseconds to seconds", async () => {
      const key = asCacheKey("test:key");
      const value = "test";
      const ttlMs = 5500; // 5.5 seconds

      const result = await cacheService.set(key, value, ttlMs);

      expect(result.ok).toBe(true);
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 5, JSON.stringify(value));
    });

    test("should return validation error for invalid TTL", async () => {
      const key = asCacheKey("test:key");
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
      const key = asCacheKey("");
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
      const key = asCacheKey("test:key");

      const result = await cacheService.del([key]);

      expect(result.ok).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith([key]);
    });

    test("should delete multiple keys", async () => {
      const keys = [asCacheKey("test:key1"), asCacheKey("test:key2")];

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(keys);
    });

    test("should be idempotent (not throw if key missing)", async () => {
      const key = asCacheKey("nonexistent:key");
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
      const keys = [asCacheKey("valid:key"), asCacheKey("")];

      const result = await cacheService.del(keys);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });
  });

  describe("withCache", () => {
    test("should return cached value when available", async () => {
      const key = asCacheKey("test:key");
      const cachedValue = { data: "cached" };
      const fn = vi.fn().mockResolvedValue({ data: "fresh" });

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(cachedValue);
      }
      expect(fn).not.toHaveBeenCalled();
    });

    test("should compute and cache value when cache miss", async () => {
      const key = asCacheKey("test:key");
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(freshValue);
      }
      expect(fn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(freshValue));
    });

    test("should return fresh value when cache operation fails", async () => {
      const key = asCacheKey("test:key");
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(freshValue);
      }
      expect(fn).toHaveBeenCalledOnce();
    });

    test("should return error when function fails", async () => {
      const key = asCacheKey("test:key");
      const fn = vi.fn().mockRejectedValue(new Error("Function failed"));

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.Unknown);
        // Error details are logged on the spot, not stored in Result
      }
      expect(fn).toHaveBeenCalledOnce();
    });
  });
});
