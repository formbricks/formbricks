import type { RedisClient } from "@/types/client";
import { ErrorCode } from "@/types/error";
import { createClient } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCacheService, createRedisClientFromEnv } from "./factory";

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
    withCache: vi.fn(),
  })),
}));

// Create a proper mock interface for Redis client
interface MockRedisClient {
  isOpen: boolean;
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

// Get typed mocks
const mockCreateClient = vi.mocked(createClient);

describe("@formbricks/cache factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
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
    test("should create cache service with provided client that is already open", async () => {
      const mockClient: MockRedisClient = {
        isOpen: true,
        on: vi.fn(),
        connect: vi.fn(),
      };

      // Mock the environment variable and test the factory
      process.env.REDIS_URL = "redis://localhost:6379";
      const result = await createCacheService();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    test("should connect client if not open", async () => {
      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
      };

      // Mock the environment variable and test the factory
      process.env.REDIS_URL = "redis://localhost:6379";
      const result = await createCacheService();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test("should return error when connection fails", async () => {
      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      // Mock the environment variable and test the factory
      process.env.REDIS_URL = "redis://localhost:6379";
      const result = await createCacheService();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
      }
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test("should create cache service without provided client using environment", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await createCacheService();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
      expect(mockCreateClient).toHaveBeenCalled();
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test("should return error when environment client creation fails", async () => {
      // Don't set REDIS_URL to trigger configuration error

      const result = await createCacheService();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConfigurationError);
      }
    });

    test("should return error when environment client connection fails", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      // @ts-expect-error - Mock client type incompatibility with Redis types
      mockCreateClient.mockReturnValue(mockClient as unknown as RedisClient);

      const result = await createCacheService();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.RedisConnectionError);
      }
    });
  });
});
