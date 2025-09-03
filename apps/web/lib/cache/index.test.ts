import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Create mocks
const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  withCache: vi.fn(),
  getRedisClient: vi.fn(),
};

const mockGetCacheService = vi.fn();
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Mock all dependencies before importing the module under test
vi.mock("@formbricks/cache", () => ({
  getCacheService: mockGetCacheService,
}));

vi.mock("@formbricks/logger", () => ({
  logger: mockLogger,
}));

// Import the module under test after mocking
let cache: any;

describe("Cache Index", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-import the module to get a fresh instance
    const cacheModule = await import("./index");
    cache = cacheModule.cache;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Singleton Behavior", () => {
    test("should call getCacheService for each method call", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Call a method multiple times
      await cache.get("test-key-1");
      await cache.get("test-key-2");
      await cache.set("test-key", "value", 1000);

      // getCacheService should be called for each operation
      expect(mockGetCacheService).toHaveBeenCalledTimes(3);
      expect(mockCacheService.get).toHaveBeenCalledWith("test-key-1");
      expect(mockCacheService.get).toHaveBeenCalledWith("test-key-2");
      expect(mockCacheService.set).toHaveBeenCalledWith("test-key", "value", 1000);
    });

    test("should proxy all cache methods correctly", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Multiple calls should use the cache service
      await cache.get("key1");
      await cache.set("key2", "value", 1000);
      await cache.del(["key3"]);

      expect(mockGetCacheService).toHaveBeenCalledTimes(3);
      expect(mockCacheService.get).toHaveBeenCalledWith("key1");
      expect(mockCacheService.set).toHaveBeenCalledWith("key2", "value", 1000);
      expect(mockCacheService.del).toHaveBeenCalledWith(["key3"]);
    });
  });

  describe("Cache Service Integration", () => {
    test("should call getCacheService on each operation", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // getCacheService should not be called until first access
      expect(mockGetCacheService).not.toHaveBeenCalled();

      // First access should trigger getCacheService call
      await cache.get("test-key");

      expect(mockGetCacheService).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledWith("test-key");
    });

    test("should handle concurrent operations correctly", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Start multiple concurrent operations
      const promise1 = cache.get("key1");
      const promise2 = cache.set("key2", "value", 1000);
      const promise3 = cache.exists("key3");

      // Wait for all operations to complete
      await Promise.all([promise1, promise2, promise3]);

      // Each operation should call getCacheService
      expect(mockGetCacheService).toHaveBeenCalledTimes(3);
      expect(mockCacheService.get).toHaveBeenCalledWith("key1");
      expect(mockCacheService.set).toHaveBeenCalledWith("key2", "value", 1000);
      expect(mockCacheService.exists).toHaveBeenCalledWith("key3");
    });
  });

  describe("Error Handling", () => {
    test("should return error object when getCacheService fails", async () => {
      const initError = {
        ok: false,
        error: { code: "REDIS_CONNECTION_ERROR" },
      };

      mockGetCacheService.mockResolvedValue(initError);

      const result = await cache.get("test-key");

      expect(result).toEqual({ ok: false, error: initError.error });
      expect(mockGetCacheService).toHaveBeenCalledTimes(1);
    });

    test("should handle getCacheService rejection", async () => {
      const networkError = new Error("Network connection failed");
      mockGetCacheService.mockRejectedValue(networkError);

      await expect(cache.get("test-key")).rejects.toThrow("Network connection failed");
    });

    test("should handle errors consistently across different methods", async () => {
      const cacheError = {
        ok: false,
        error: { code: "CONNECTION_FAILED" },
      };

      mockGetCacheService.mockResolvedValue(cacheError);

      // All methods should return the same error structure
      const getResult = await cache.get("test-key");
      const setResult = await cache.set("test-key", "value", 1000);
      const delResult = await cache.del(["test-key"]);
      const existsResult = await cache.exists("test-key");

      expect(getResult).toEqual({ ok: false, error: cacheError.error });
      expect(setResult).toEqual({ ok: false, error: cacheError.error });
      expect(delResult).toEqual({ ok: false, error: cacheError.error });
      expect(existsResult).toEqual({ ok: false, error: cacheError.error });
    });
  });

  describe("Proxy Functionality", () => {
    beforeEach(() => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });
    });

    test("should proxy get method correctly", async () => {
      mockCacheService.get.mockResolvedValue({ ok: true, data: "cached-value" });

      const result = await cache.get("test-key");

      expect(mockCacheService.get).toHaveBeenCalledWith("test-key");
      expect(result).toEqual({ ok: true, data: "cached-value" });
    });

    test("should proxy set method correctly", async () => {
      mockCacheService.set.mockResolvedValue({ ok: true, data: undefined });

      const result = await cache.set("test-key", "test-value", 5000);

      expect(mockCacheService.set).toHaveBeenCalledWith("test-key", "test-value", 5000);
      expect(result).toEqual({ ok: true, data: undefined });
    });

    test("should proxy del method correctly", async () => {
      mockCacheService.del.mockResolvedValue({ ok: true, data: undefined });

      const result = await cache.del(["key1", "key2"]);

      expect(mockCacheService.del).toHaveBeenCalledWith(["key1", "key2"]);
      expect(result).toEqual({ ok: true, data: undefined });
    });

    test("should proxy exists method correctly", async () => {
      mockCacheService.exists.mockResolvedValue({ ok: true, data: true });

      const result = await cache.exists("test-key");

      expect(mockCacheService.exists).toHaveBeenCalledWith("test-key");
      expect(result).toEqual({ ok: true, data: true });
    });

    test("should proxy withCache method correctly when cache is available", async () => {
      const mockFn = vi.fn().mockResolvedValue("function-result");
      mockCacheService.withCache.mockResolvedValue("cached-result");

      const result = await cache.withCache(mockFn, "cache-key", 3000);

      expect(mockCacheService.withCache).toHaveBeenCalledWith(mockFn, "cache-key", 3000);
      expect(result).toBe("cached-result");
    });

    test("should execute function directly when cache service fails", async () => {
      const mockFn = vi.fn().mockResolvedValue("function-result");

      mockGetCacheService.mockResolvedValue({
        ok: false,
        error: { code: "CACHE_UNAVAILABLE" },
      });

      const result = await cache.withCache(mockFn);

      expect(result).toBe("function-result");
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockCacheService.withCache).not.toHaveBeenCalled();
    });

    test("should execute function directly when cache service throws error", async () => {
      const mockFn = vi.fn().mockResolvedValue("function-result");
      const cacheError = new Error("Cache connection failed");

      mockGetCacheService.mockRejectedValue(cacheError);

      const result = await cache.withCache(mockFn);

      expect(result).toBe("function-result");
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: cacheError },
        "Cache unavailable; executing function directly"
      );
    });

    test("should proxy getRedisClient method correctly", async () => {
      const mockRedisClient = { ping: vi.fn() };
      mockCacheService.getRedisClient.mockReturnValue(mockRedisClient);

      const result = await cache.getRedisClient();

      expect(mockCacheService.getRedisClient).toHaveBeenCalled();
      expect(result).toBe(mockRedisClient);
    });

    test("should handle method errors correctly", async () => {
      const cacheError = new Error("Cache operation failed");
      mockCacheService.get.mockRejectedValue(cacheError);

      await expect(cache.get("test-key")).rejects.toThrow("Cache operation failed");
    });
  });

  describe("Type Safety", () => {
    test("should maintain type safety through proxy", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // TypeScript should enforce correct method signatures
      mockCacheService.get.mockResolvedValue({ ok: true, data: "string-value" });
      mockCacheService.set.mockResolvedValue({ ok: true, data: undefined });
      mockCacheService.exists.mockResolvedValue({ ok: true, data: true });

      // These should compile without type errors
      const getValue: Promise<any> = cache.get("key");
      const setValue: Promise<any> = cache.set("key", "value", 1000);
      const existsValue: Promise<any> = cache.exists("key");
      const delValue: Promise<any> = cache.del(["key"]);

      // Verify the calls work
      await getValue;
      await setValue;
      await existsValue;
      await delValue;

      expect(mockCacheService.get).toHaveBeenCalledWith("key");
      expect(mockCacheService.set).toHaveBeenCalledWith("key", "value", 1000);
      expect(mockCacheService.exists).toHaveBeenCalledWith("key");
      expect(mockCacheService.del).toHaveBeenCalledWith(["key"]);
    });
  });

  describe("Integration Scenarios", () => {
    test("should handle rapid successive calls", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      mockCacheService.get.mockResolvedValue({ ok: true, data: null });
      mockCacheService.set.mockResolvedValue({ ok: true, data: undefined });

      // Make many rapid calls
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.all([
          cache.get(`key-${i}`),
          cache.set(`key-${i}`, `value-${i}`, 1000),
          cache.exists(`key-${i}`),
        ])
      );

      await Promise.all(promises);

      // Each operation calls getCacheService
      expect(mockGetCacheService).toHaveBeenCalledTimes(30); // 10 * 3 operations
      expect(mockCacheService.get).toHaveBeenCalledTimes(10);
      expect(mockCacheService.set).toHaveBeenCalledTimes(10);
      expect(mockCacheService.exists).toHaveBeenCalledTimes(10);
    });

    test("should work in server environment", async () => {
      mockGetCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Simulate server-only environment (which is already mocked by the "server-only" import)
      mockCacheService.get.mockResolvedValue({ ok: true, data: "server-value" });

      const result = await cache.get("server-key");

      expect(result).toEqual({ ok: true, data: "server-value" });
      expect(mockGetCacheService).toHaveBeenCalledTimes(1);
    });
  });
});
