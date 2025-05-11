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
    vi.mocked(Keyv).mockClear(); // Clear any previous calls
    vi.mocked(KeyvRedis).mockClear(); // Clear any previous calls
    vi.mocked(logger.warn).mockClear(); // Clear logger warnings
  });

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe("Initialization and getCache", () => {
    test("should use Redis store and return it via getCache if REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getCache } = await import("./service"); // Dynamically import

      expect(KeyvRedis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(Keyv).toHaveBeenCalledWith({
        store: expect.any(KeyvRedis),
        ttl: CACHE_TTL_MS,
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(getCache()).toBe(mockCacheInstance);
    });

    test("should use memory store, log warning, and return it via getCache if REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;
      const { getCache } = await import("./service"); // Dynamically import

      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith({
        ttl: CACHE_TTL_MS,
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      expect(logger.warn).toHaveBeenCalledWith("REDIS_URL not found, falling back to in-memory cache.");
      expect(getCache()).toBe(mockCacheInstance);
    });

    test("should use memory store, log warning, and return it via getCache if REDIS_URL is an empty string", async () => {
      process.env.REDIS_URL = ""; // Test with empty string
      const { getCache } = await import("./service"); // Dynamically import

      // If REDIS_URL is "", it's falsy, so it should fall back to memory store
      expect(KeyvRedis).not.toHaveBeenCalled();
      expect(Keyv).toHaveBeenCalledWith({
        ttl: CACHE_TTL_MS, // Expect memory store configuration
      });
      expect(createCache).toHaveBeenCalledWith({
        stores: [expect.any(Keyv)],
        ttl: CACHE_TTL_MS,
      });
      expect(logger.warn).toHaveBeenCalledWith("REDIS_URL not found, falling back to in-memory cache.");
      expect(getCache()).toBe(mockCacheInstance);
    });
  });
});
