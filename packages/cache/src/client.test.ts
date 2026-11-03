import { rootCertificates } from "node:tls";
import { createClient } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
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
  CacheService: class MockCacheService {
    private redis: RedisClient | null;

    constructor(redis: RedisClient | null = null) {
      this.redis = redis;
    }

    get = vi.fn();
    set = vi.fn();
    del = vi.fn();
    exists = vi.fn();
    withCache = vi.fn();

    getRedisClient = vi.fn(() => {
      if (!this.redis || !this.redis.isReady || !this.redis.isOpen) {
        return null;
      }
      return this.redis;
    });
  },
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
    delete process.env.REDIS_TLS_CA;
    resetCacheFactory();
  });

  describe("createRedisClientFromEnv", () => {
    test("passes private trust and strict verification to the cache connection", async () => {
      process.env.REDIS_URL = "rediss://127.0.0.1:6378";
      process.env.REDIS_TLS_CA = rootCertificates[0];
      const client = {
        isReady: true,
        isOpen: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
      };
      mockCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>);

      expect((await createRedisClientFromEnv()).ok).toBe(true);
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({
          socket: {
            tls: true,
            ca: [rootCertificates[0].trim()],
            rejectUnauthorized: true,
            connectTimeout: 750,
            reconnectStrategy: false,
          },
        })
      );
    });

    test("fails configuration before opening a connection when a CA is supplied for plaintext", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.REDIS_TLS_CA = rootCertificates[0];

      expect(await createRedisClientFromEnv()).toEqual({
        ok: false,
        error: { code: ErrorCode.RedisConfigurationError },
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

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
          connectTimeout: 750,
          reconnectStrategy: false,
        },
        disableOfflineQueue: true,
        commandsQueueMaxLength: 1000,
        pingInterval: 300_000,
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
          connectTimeout: 750,
          reconnectStrategy: false,
        },
        disableOfflineQueue: true,
        commandsQueueMaxLength: 1000,
        pingInterval: 300_000,
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

    test("discards a connection that becomes unready before opening another", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const mockClient: MockRedisClient = {
        isOpen: true,
        isReady: true,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
      };
      mockCreateClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

      expect((await getCacheService()).ok).toBe(true);
      mockClient.isReady = false;

      expect(await getCacheService()).toEqual({
        ok: false,
        error: { code: ErrorCode.RedisConnectionError },
      });
      expect(mockClient.destroy).toHaveBeenCalledOnce();
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect((await getCacheService()).ok).toBe(false);
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });

    test("should allow retry after failed initialization", async () => {
      const now = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(now);
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

      // An open circuit rejects immediately; one request probes after the cooldown.
      expect((await getCacheService()).ok).toBe(false);
      clock.mockReturnValue(now + 5000);
      const secondResult = await getCacheService();
      expect(secondResult.ok).toBe(true);
      clock.mockRestore();
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
      const cause = Object.assign(new Error("private connection detail"), { code: "ECONNRESET" });

      const mockClient: MockRedisClient = {
        isOpen: false,
        isReady: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
        destroy: vi.fn().mockRejectedValue(new AggregateError([cause], "private destroy detail")),
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
      await vi.waitFor(() =>
        expect(logger.error).toHaveBeenCalledWith(
          { name: "AggregateError", causes: [{ name: "Error", code: "ECONNRESET" }] },
          "Error destroying Redis client"
        )
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("private connection detail");
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("private destroy detail");
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
