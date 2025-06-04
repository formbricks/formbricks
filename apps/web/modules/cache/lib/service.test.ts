import KeyvRedis from "@keyv/redis";
import { createCache } from "cache-manager";
import { Keyv } from "keyv";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";

// Mock dependencies
vi.mock("keyv");
vi.mock("@keyv/redis");
vi.mock("cache-manager");
vi.mock("@formbricks/logger");

const mockCacheInstance = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

describe("Cache Service", () => {
  let originalRedisUrl: string | undefined;
  let originalNextRuntime: string | undefined;

  beforeEach(() => {
    originalRedisUrl = process.env.REDIS_URL;
    originalNextRuntime = process.env.NEXT_RUNTIME;

    // Ensure we're in runtime mode (not build time)
    process.env.NEXT_RUNTIME = "nodejs";

    vi.resetAllMocks();
    vi.resetModules();

    // Setup default mock implementations
    vi.mocked(createCache).mockReturnValue(mockCacheInstance as any);
    vi.mocked(Keyv).mockClear();
    vi.mocked(KeyvRedis).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.info).mockClear();

    // Mock successful cache operations for Redis connection test
    mockCacheInstance.set.mockResolvedValue(undefined);
    mockCacheInstance.get.mockResolvedValue({ test: true });
    mockCacheInstance.del.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
    process.env.NEXT_RUNTIME = originalNextRuntime;
  });

  describe("Initialization and getCache", () => {
    test("should use Redis store and return it via getCache if REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getCache } = await import("./service");

      const cache = await getCache();

      expect(KeyvRedis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(Keyv).toHaveBeenCalledWith({
        store: expect.any(KeyvRedis),
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
      });
      expect(logger.info).toHaveBeenCalledWith("Cache initialized with Redis");
      expect(cache).toBe(mockCacheInstance);
    });

    test("should fall back to memory store if Redis connection fails", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const mockError = new Error("Connection refused");

      // Mock cache operations to fail for Redis connection test
      mockCacheInstance.get.mockRejectedValueOnce(mockError);

      const { getCache } = await import("./service");

      const cache = await getCache();

      expect(KeyvRedis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(logger.warn).toHaveBeenCalledWith("Redis connection failed, using memory cache", {
        error: mockError,
      });
      expect(cache).toBe(mockCacheInstance);
    });

    test("should use memory store and return it via getCache if REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;
      const { getCache } = await import("./service");

      const cache = await getCache();

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith();
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
      });
      expect(cache).toBe(mockCacheInstance);
    });

    test("should use memory store and return it via getCache if REDIS_URL is an empty string", async () => {
      process.env.REDIS_URL = "";
      const { getCache } = await import("./service");

      const cache = await getCache();

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith();
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
      });
      expect(cache).toBe(mockCacheInstance);
    });

    test("should return same instance on multiple calls to getCache", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getCache } = await import("./service");

      const cache1 = await getCache();
      const cache2 = await getCache();

      expect(cache1).toBe(cache2);
      expect(cache1).toBe(mockCacheInstance);
      // Should only initialize once
      expect(createCache).toHaveBeenCalledTimes(1);
    });

    test("should use memory cache during build time", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      delete process.env.NEXT_RUNTIME; // Simulate build time

      const { getCache } = await import("./service");

      const cache = await getCache();

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith();
      expect(cache).toBe(mockCacheInstance);
    });

    test("should provide cache health information", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getCache, getCacheHealth } = await import("./service");

      // Before initialization
      let health = getCacheHealth();
      expect(health.isInitialized).toBe(false);
      expect(health.hasInstance).toBe(false);

      // After initialization
      await getCache();
      health = getCacheHealth();
      expect(health.isInitialized).toBe(true);
      expect(health.hasInstance).toBe(true);
      expect(health.isRedisConnected).toBe(true);
    });
  });
});
