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

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

describe("Cache Service", () => {
  let originalRedisUrl: string | undefined;

  beforeEach(() => {
    originalRedisUrl = process.env.REDIS_URL;
    vi.resetAllMocks();
    vi.resetModules(); // Crucial for re-running module initialization logic

    // Setup default mock implementations
    vi.mocked(createCache).mockReturnValue(mockCacheInstance as any);
    vi.mocked(Keyv).mockClear();
    vi.mocked(KeyvRedis).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.info).mockClear();

    // Mock successful cache operations for Redis connection test
    mockCacheInstance.set.mockResolvedValue(undefined);
    mockCacheInstance.del.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe("Initialization and getCache", () => {
    test("should use Redis store and return it via getCache if REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getCache } = await import("./service");

      // Call getCache to trigger async initialization
      const cache = await getCache();

      expect(KeyvRedis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(Keyv).toHaveBeenCalledWith({
        store: expect.any(KeyvRedis),
        ttl: CACHE_TTL_MS,
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      expect(logger.info).toHaveBeenCalledWith("Attempting to connect to Redis cache...");
      expect(logger.info).toHaveBeenCalledWith("Redis cache connected successfully");
      expect(cache).toBe(mockCacheInstance);
    });

    test("should fall back to memory store if Redis connection fails", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const mockError = new Error("Connection refused");

      // Mock cache operations to fail for Redis connection test
      mockCacheInstance.set.mockRejectedValueOnce(mockError);

      const { getCache } = await import("./service");

      // Call getCache to trigger async initialization
      const cache = await getCache();

      expect(KeyvRedis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to initialize Redis cache, falling back to memory cache",
        expect.objectContaining({
          error: "Connection refused",
        })
      );
      expect(logger.info).toHaveBeenCalledWith("Cache service initialized with in-memory storage");
      expect(cache).toBe(mockCacheInstance);
    });

    test("should use memory store and return it via getCache if REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;
      const { getCache } = await import("./service");

      // Call getCache to trigger async initialization
      const cache = await getCache();

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith({
        ttl: CACHE_TTL_MS,
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      // Fast path doesn't log - this is the optimized behavior
      expect(cache).toBe(mockCacheInstance);
    });

    test("should use memory store and return it via getCache if REDIS_URL is an empty string", async () => {
      process.env.REDIS_URL = "";
      const { getCache } = await import("./service");

      // Call getCache to trigger async initialization
      const cache = await getCache();

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith({
        ttl: CACHE_TTL_MS,
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      // Fast path doesn't log - this is the optimized behavior
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
