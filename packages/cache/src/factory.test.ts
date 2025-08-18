import { beforeEach, describe, expect, test, vi } from "vitest";
import { type RedisClient, createCacheService, createRedisClientFromEnv } from "./index";

// Mock the redis module
vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    on: vi.fn(),
    isOpen: false,
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Create a proper mock interface for Redis client
interface MockRedisClient {
  isOpen: boolean;
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

describe("@formbricks/cache factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
  });

  describe("createRedisClientFromEnv", () => {
    test("should throw error when REDIS_URL is not set", () => {
      expect(() => createRedisClientFromEnv()).toThrow("REDIS_URL is required for @formbricks/cache");
    });

    test("should create client when REDIS_URL is set", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const client = createRedisClientFromEnv();
      expect(client).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- testing mocked method
      expect(client.on).toHaveBeenCalledWith("error", expect.any(Function));
      // eslint-disable-next-line @typescript-eslint/unbound-method -- testing mocked method
      expect(client.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });
  });

  describe("createCacheService", () => {
    test("should create cache service with provided client", async () => {
      const mockClient: MockRedisClient = {
        isOpen: true,
        on: vi.fn(),
        connect: vi.fn(),
      };

      const service = await createCacheService(mockClient as unknown as RedisClient);
      expect(service).toBeDefined();
      expect(service.client).toBe(mockClient);
    });

    test("should connect client if not open", async () => {
      const mockClient: MockRedisClient = {
        isOpen: false,
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
      };

      await createCacheService(mockClient as unknown as RedisClient);
      expect(mockClient.connect).toHaveBeenCalled();
    });
  });
});
