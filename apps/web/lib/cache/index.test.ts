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

const mockCreateCacheService = vi.fn();
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Mock all dependencies before importing the module under test
vi.mock("@formbricks/cache", () => ({
  createCacheService: mockCreateCacheService,
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
    test("should initialize cache service only once", async () => {
      mockCreateCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Call a method multiple times
      await cache.get("test-key-1");
      await cache.get("test-key-2");
      await cache.set("test-key", "value", 1000);

      // createCacheService should only be called once
      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("Initializing cache service...");
      expect(mockLogger.debug).toHaveBeenCalledWith("Cache service initialized successfully");
    });

    test("should reuse same cache instance across multiple calls", async () => {
      mockCreateCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Multiple calls should use the same instance
      await cache.get("key1");
      await cache.set("key2", "value", 1000);
      await cache.del(["key3"]);

      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledWith("key1");
      expect(mockCacheService.set).toHaveBeenCalledWith("key2", "value", 1000);
      expect(mockCacheService.del).toHaveBeenCalledWith(["key3"]);
    });
  });

  describe("Lazy Initialization", () => {
    test("should not initialize cache until first access", async () => {
      mockCreateCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Cache should not be initialized yet
      expect(mockCreateCacheService).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith("Initializing cache service...");

      // First access should trigger initialization
      await cache.get("test-key");

      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("Initializing cache service...");
    });

    test("should handle concurrent initialization attempts", async () => {
      let resolveInit: (value: any) => void;
      const initPromise = new Promise((resolve) => {
        resolveInit = resolve;
      });

      mockCreateCacheService.mockReturnValue(initPromise);

      // Start multiple concurrent operations
      const promise1 = cache.get("key1");
      const promise2 = cache.set("key2", "value", 1000);
      const promise3 = cache.exists("key3");

      // All should be waiting for initialization
      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);

      // Resolve the initialization
      resolveInit!({
        ok: true,
        data: mockCacheService,
      });

      // Wait for all operations to complete
      await Promise.all([promise1, promise2, promise3]);

      // Should only have initialized once
      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledWith("key1");
      expect(mockCacheService.set).toHaveBeenCalledWith("key2", "value", 1000);
      expect(mockCacheService.exists).toHaveBeenCalledWith("key3");
    });
  });

  describe("Error Handling", () => {
    test("should throw error when cache initialization fails", async () => {
      const initError = {
        ok: false,
        error: { code: "REDIS_CONNECTION_ERROR" },
      };

      mockCreateCacheService.mockResolvedValue(initError);

      await expect(cache.get("test-key")).rejects.toThrow(
        "Cache initialization failed: REDIS_CONNECTION_ERROR"
      );

      expect(mockLogger.error).toHaveBeenCalledWith("Cache service initialization failed", {
        error: initError.error,
      });
    });

    test("should handle createCacheService rejection", async () => {
      const networkError = new Error("Network connection failed");
      mockCreateCacheService.mockRejectedValue(networkError);

      await expect(cache.get("test-key")).rejects.toThrow("Network connection failed");
    });

    test("should retry initialization after failure", async () => {
      // First instance fails
      mockCreateCacheService.mockResolvedValue({
        ok: false,
        error: { code: "REDIS_CONNECTION_ERROR" },
      });

      // First attempt should fail
      await expect(cache.get("test-key-1")).rejects.toThrow();

      // Reset and create fresh instance for second attempt
      vi.clearAllMocks();
      vi.resetModules();

      // Mock successful cache service operation for second attempt
      mockCacheService.get.mockResolvedValue({ ok: true, data: "cached-value" });

      // Second instance succeeds
      mockCreateCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      const freshCacheModule = await import("./index");
      const freshCache = freshCacheModule.cache;

      // Second attempt should succeed
      const result = await freshCache.get("test-key-2" as any);
      expect(result).toBeDefined();
      expect(result).toEqual({ ok: true, data: "cached-value" });

      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
    });
  });

  describe("Proxy Functionality", () => {
    beforeEach(() => {
      mockCreateCacheService.mockResolvedValue({
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

    test("should proxy withCache method correctly", async () => {
      const mockFn = vi.fn().mockResolvedValue("function-result");
      mockCacheService.withCache.mockResolvedValue("cached-result");

      const result = await cache.withCache(mockFn, "cache-key", 3000);

      expect(mockCacheService.withCache).toHaveBeenCalledWith(mockFn, "cache-key", 3000);
      expect(result).toBe("cached-result");
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
      mockCreateCacheService.mockResolvedValue({
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
      mockCreateCacheService.mockResolvedValue({
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

      // Should only initialize once despite many concurrent calls
      expect(mockCreateCacheService).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledTimes(10);
      expect(mockCacheService.set).toHaveBeenCalledTimes(10);
      expect(mockCacheService.exists).toHaveBeenCalledTimes(10);
    });

    test("should work in server environment", async () => {
      mockCreateCacheService.mockResolvedValue({
        ok: true,
        data: mockCacheService,
      });

      // Simulate server-only environment (which is already mocked by the "server-only" import)
      mockCacheService.get.mockResolvedValue({ ok: true, data: "server-value" });

      const result = await cache.get("server-key");

      expect(result).toEqual({ ok: true, data: "server-value" });
      expect(mockLogger.debug).toHaveBeenCalledWith("Initializing cache service...");
    });
  });
});
