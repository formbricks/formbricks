import { createClient } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RedisClient } from "@/types/client";
import { ErrorCode } from "@/types/error";
import { __resetCacheFactoryForTests, createCacheService, createRedisClientFromEnv } from "./factory";

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
  },
}));

// Mock CacheService
vi.mock("./service", () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    withCache: vi.fn(),
    getRedisClient: vi.fn(),
  })),
}));

// Create a proper mock interface for Redis client
interface MockRedisClient {
  isOpen: boolean;
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
    __resetCacheFactoryForTests();
  });

  describe("createRedisClientFromEnv", () => {
    test("should return error when REDIS_URL is not set", () => {
      const result = createRedisClientFromEnv();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConfigurationError);
      }
    });

    test("should create client when REDIS_URL is set", () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = createRedisClientFromEnv();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(mockClient);
      }

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: {
          reconnectStrategy: expect.any(Function) as (retries: number) => number,
        },
      });

      // Verify event handlers are set up
      expect(mockClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("reconnecting", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("end", expect.any(Function));
    });

    test("should configure reconnection strategy correctly", () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      createRedisClientFromEnv();

      const createClientCall = mockCreateClient.mock.calls[0];
      const config = createClientCall[0] as { socket: { reconnectStrategy: (retries: number) => number } };
      const reconnectStrategy = config.socket.reconnectStrategy;

      // Test early retry attempts (exponential backoff with max 5s)
      expect(reconnectStrategy(1)).toBe(1000);
      expect(reconnectStrategy(3)).toBe(3000);
      expect(reconnectStrategy(5)).toBe(5000);

      // Test extended delay after 5 attempts (> 5 retries)
      expect(reconnectStrategy(6)).toBe(30000);
      expect(reconnectStrategy(7)).toBe(30000);
      expect(reconnectStrategy(10)).toBe(30000);
    });
  });

  describe("createCacheService", () => {
    test("should return error when environment client creation fails", async () => {
      // Don't set REDIS_URL to trigger configuration error

      const result = await createCacheService();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConfigurationError);
      }
    });

    test("should create cache service successfully with valid environment", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await createCacheService();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    test("should handle concurrent initialization safely", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Start multiple concurrent calls
      const promises = Array(3)
        .fill(null)
        .map(() => createCacheService());
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
        isOpen: false,
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
      const firstResult = await createCacheService();
      expect(firstResult.ok).toBe(false);

      // Second call should succeed (after retry)
      const secondResult = await createCacheService();
      expect(secondResult.ok).toBe(true);
    });

    test("should call destroy on connection failure to prevent zombie reconnections", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Call should fail
      const result = await createCacheService();
      expect(result.ok).toBe(false);

      // Verify destroy was called to prevent zombie reconnections
      expect(mockClient.destroy).toHaveBeenCalledTimes(1);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    test("should handle destroy failure gracefully", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockRejectedValue(new Error("Destroy failed")),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Call should fail but destroy failure should not interfere
      const result = await createCacheService();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
      }

      // Verify destroy was attempted even though it failed
      expect(mockClient.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("__resetCacheFactoryForTests", () => {
    test("should reset singleton and initializing state", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      // Create initial service
      const firstResult = await createCacheService();
      expect(firstResult.ok).toBe(true);

      // Reset the factory
      __resetCacheFactoryForTests();

      // Create another service - should create a new instance
      const secondResult = await createCacheService();
      expect(secondResult.ok).toBe(true);

      // Should have called createClient twice (once for each service)
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
    });
  });
});
