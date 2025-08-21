import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { asCacheKey } from "../types/keys";
import { CacheValidationError } from "../types/service";
import type { RedisClient } from "./factory";
import { CacheService } from "./service";

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
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

      expect(result).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    test("should return null when key not found", async () => {
      const key = asCacheKey("test:key");
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    test("should return null when JSON parse fails (corrupted data)", async () => {
      const key = asCacheKey("test:key");
      const corruptedValue = "invalid json {broken";
      mockRedis.get.mockResolvedValue(corruptedValue);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Corrupted cache data detected, treating as cache miss",
        expect.objectContaining({
          key,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() returns any for test assertions
          parseError: expect.any(Error),
        })
      );
    });

    test("should throw CacheValidationError for empty key", async () => {
      const key = asCacheKey("");

      await expect(cacheService.get(key)).rejects.toThrow(CacheValidationError);
    });

    test("should throw CacheValidationError for whitespace-only key", async () => {
      const key = asCacheKey("   ");

      await expect(cacheService.get(key)).rejects.toThrow(CacheValidationError);
    });
  });

  describe("set", () => {
    test("should store JSON serialized value with TTL", async () => {
      const key = asCacheKey("test:key");
      const value = { data: "test" };
      const ttlMs = 60000;

      await cacheService.set(key, value, ttlMs);

      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(value));
    });

    test("should convert TTL from milliseconds to seconds", async () => {
      const key = asCacheKey("test:key");
      const value = "test";
      const ttlMs = 5500; // 5.5 seconds

      await cacheService.set(key, value, ttlMs);

      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 5, JSON.stringify(value));
    });

    test("should throw CacheValidationError for non-positive TTL", async () => {
      const key = asCacheKey("test:key");
      const value = "test";

      await expect(cacheService.set(key, value, 0)).rejects.toThrow(CacheValidationError);
      await expect(cacheService.set(key, value, -1)).rejects.toThrow(CacheValidationError);
    });

    test("should throw CacheValidationError for empty key", async () => {
      const key = asCacheKey("");
      const value = "test";

      await expect(cacheService.set(key, value, 1000)).rejects.toThrow(CacheValidationError);
    });
  });

  describe("del", () => {
    test("should delete single key", async () => {
      const key = asCacheKey("test:key");

      await cacheService.del(key);

      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    test("should delete multiple keys", async () => {
      const keys = [asCacheKey("test:key1"), asCacheKey("test:key2")];

      await cacheService.del(keys);

      expect(mockRedis.del).toHaveBeenCalledWith(asCacheKey("test:key1"), asCacheKey("test:key2"));
    });

    test("should be idempotent (not throw if key missing)", async () => {
      const key = asCacheKey("nonexistent:key");
      mockRedis.del.mockResolvedValue(0);

      await expect(cacheService.del(key)).resolves.not.toThrow();
    });

    test("should handle empty array gracefully", async () => {
      await cacheService.del([]);

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    test("should throw CacheValidationError for empty key in array", async () => {
      const keys = [asCacheKey("valid:key"), asCacheKey("")];

      await expect(cacheService.del(keys)).rejects.toThrow(CacheValidationError);
    });
  });

  describe("withCache", () => {
    test("should return cached value when available", async () => {
      const key = asCacheKey("test:key");
      const cachedValue = { data: "cached" };
      const fn = vi.fn().mockResolvedValue({ data: "fresh" });

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(cachedValue);
      expect(fn).not.toHaveBeenCalled();
    });

    test("should compute and cache value when cache miss", async () => {
      const key = asCacheKey("test:key");
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(freshValue);
      expect(fn).toHaveBeenCalledOnce();
      expect(mockRedis.setEx).toHaveBeenCalledWith(key, 60, JSON.stringify(freshValue));
    });

    test("should return fresh value when cache operation fails", async () => {
      const key = asCacheKey("test:key");
      const freshValue = { data: "fresh" };
      const fn = vi.fn().mockResolvedValue(freshValue);

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheService.withCache(fn, key, 60000);

      expect(result).toEqual(freshValue);
      expect(fn).toHaveBeenCalledOnce();
    });

    test("should throw function error when both cache and function fail", async () => {
      const key = asCacheKey("test:key");
      const fn = vi.fn().mockRejectedValue(new Error("Function failed"));

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      await expect(cacheService.withCache(fn, key, 60000)).rejects.toThrow("Function failed");
      expect(fn).toHaveBeenCalledOnce();
    });
  });
});
