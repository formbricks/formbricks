import { createClient } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RedisClient } from "@/types/client";
import { ErrorCode } from "@/types/error";
import { createRedisClientFromEnv, getCacheService, resetCacheFactory } from "./client";

// Mock the redis module
vi.mock("redis", () => ({
  createClient: vi.fn(),
}));

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock CacheService
vi.mock("./service", () => ({
  CacheService: vi.fn().mockImplementation((redis: RedisClient | null = null) => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    withCache: vi.fn(),
    getRedisClient: vi.fn().mockImplementation(() => {
      if (!redis || !redis.isReady || !redis.isOpen) {
        return null;
      }
      return redis;
    }),
  })),
}));

// Create a proper mock interface for Redis client
interface MockRedisClient {
  isOpen: boolean;
  isReady: boolean;
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

// Get typed mocks
const mockCreateClient = vi.mocked(createClient);

describe("@formbricks/cache factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    resetCacheFactory();
  });

  describe("createRedisClientFromEnv", () => {
    test("should return error when REDIS_URL is not set", async () => {
      const result = await createRedisClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConfigurationError);
        expect(typeof result.error).toBe("object");
        expect(result.error).toHaveProperty("code");
      }
    });

    test("should create client when REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await createRedisClientFromEnv();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(mockClient);
      }

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: {
          connectTimeout: 3000,
        },
      });

      // Verify event handlers are set up
      expect(mockClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("end", expect.any(Function));
    });

    test("should return error when client connection fails", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        isReady: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await createRedisClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
        expect(typeof result.error).toBe("object");
        expect(result.error).toHaveProperty("code");
      }

      // Verify client was created and connect was attempted
      expect(mockCreateClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: {
          connectTimeout: 3000,
        },
      });
      expect(mockClient.connect).toHaveBeenCalled();
    });
  });

  describe("getCacheService", () => {
    test("should return error when environment client creation fails", async () => {
      // Don't set REDIS_URL to trigger configuration error

      const result = await getCacheService();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConfigurationError);
        expect(typeof result.error).toBe("object");
        expect(result.error).toHaveProperty("code");
      }
    });

    test("should create cache service successfully with valid environment", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await getCacheService();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should handle concurrent initialization safely", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Start multiple concurrent calls
      const promises = Array(3)
        .fill(null)
        .map(() => getCacheService());
      const results = await Promise.all(promises);

      // All should succeed and return the same instance
      results.forEach((result) => {
        expect(result.ok).toBe(true);
      });
      if (results[0].ok && results[1].ok && results[2].ok) {
        expect(results[0].data).toBe(results[1].data);
        expect(results[1].data).toBe(results[2].data);
      }

      // Only one client should have been created
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    test("should allow retry after failed initialization", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi
          .fn()
          .mockRejectedValueOnce(new Error("Connection failed"))
          .mockResolvedValueOnce(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // First call should fail
      const firstResult = await getCacheService();
      expect(firstResult.ok).toBe(false);

      // Second call should succeed (after retry)
      const secondResult = await getCacheService();
      expect(secondResult.ok).toBe(true);
    });

    test("should handle connection failure and return error", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        isReady: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Call should fail
      const result = await getCacheService();
      expect(result.ok).toBe(false);

      if (!result.ok) {
        // The error should be a simple error object from createRedisClientFromEnv
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
        expect(typeof result.error).toBe("object");
        expect(result.error).toHaveProperty("code");
      }

      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    test("should handle connection errors gracefully", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        isReady: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockRejectedValue(new Error("Destroy failed")),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Call should fail with connection error
      const result = await getCacheService();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // The error should be a simple error object from createRedisClientFromEnv
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
        expect(typeof result.error).toBe("object");
        expect(result.error).toHaveProperty("code");
      }
    });
  });

  describe("resetCacheFactory", () => {
    test("should reset singleton and initializing state", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Create initial service
      const firstResult = await getCacheService();
      expect(firstResult.ok).toBe(true);

      // Reset the factory
      resetCacheFactory();

      // Create another service - should create a new instance
      const secondResult = await getCacheService();
      expect(secondResult.ok).toBe(true);

      // Should have called createClient twice (once for each service)
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
    });
  });
});
