import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the redis client
const mockRedisClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  isReady: true,
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  keys: vi.fn(),
  flushall: vi.fn(),
};

vi.mock("redis", () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

// Mock crypto for UUID generation
vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

describe("Redis module", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variable
    process.env.REDIS_URL = "redis://localhost:6379";

    // Reset isReady state
    mockRedisClient.isReady = true;

    // Make connect resolve successfully
    mockRedisClient.connect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = undefined;
  });

  describe("Module initialization", () => {
    test("should create Redis client when REDIS_URL is set", async () => {
      const { createClient } = await import("redis");

      // Re-import the module to trigger initialization
      await import("./redis");

      expect(createClient).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: {
          reconnectStrategy: expect.any(Function),
        },
      });
    });

    test("should not create Redis client when REDIS_URL is not set", async () => {
      delete process.env.REDIS_URL;

      const { createClient } = await import("redis");

      // Clear the module cache and re-import
      vi.resetModules();
      await import("./redis");

      expect(createClient).not.toHaveBeenCalled();
    });

    test("should set up event listeners", async () => {
      // Re-import the module to trigger initialization
      await import("./redis");

      expect(mockRedisClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith("reconnecting", expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith("ready", expect.any(Function));
    });

    test("should attempt initial connection", async () => {
      // Re-import the module to trigger initialization
      await import("./redis");

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });
  });

  describe("getRedisClient", () => {
    test("should return client when ready", async () => {
      mockRedisClient.isReady = true;

      const { getRedisClient } = await import("./redis");
      const client = getRedisClient();

      expect(client).toBe(mockRedisClient);
    });

    test("should return null when client is not ready", async () => {
      mockRedisClient.isReady = false;

      const { getRedisClient } = await import("./redis");
      const client = getRedisClient();

      expect(client).toBeNull();
    });

    test("should return null when no REDIS_URL is set", async () => {
      delete process.env.REDIS_URL;

      vi.resetModules();
      const { getRedisClient } = await import("./redis");
      const client = getRedisClient();

      expect(client).toBeNull();
    });
  });

  describe("disconnectRedis", () => {
    test("should disconnect the client", async () => {
      const { disconnectRedis } = await import("./redis");

      await disconnectRedis();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    test("should handle case when client is null", async () => {
      delete process.env.REDIS_URL;

      vi.resetModules();
      const { disconnectRedis } = await import("./redis");

      await expect(disconnectRedis()).resolves.toBeUndefined();
    });
  });

  describe("Reconnection strategy", () => {
    test("should configure reconnection strategy properly", async () => {
      const { createClient } = await import("redis");

      // Re-import the module to trigger initialization
      await import("./redis");

      const createClientCall = vi.mocked(createClient).mock.calls[0];
      const config = createClientCall[0] as any;

      expect(config.socket.reconnectStrategy).toBeDefined();
      expect(typeof config.socket.reconnectStrategy).toBe("function");
    });
  });

  describe("Event handlers", () => {
    test("should log error events", async () => {
      const { logger } = await import("@formbricks/logger");

      // Re-import the module to trigger initialization
      await import("./redis");

      // Find the error event handler
      const errorCall = vi.mocked(mockRedisClient.on).mock.calls.find((call) => call[0] === "error");
      const errorHandler = errorCall?.[1];

      const testError = new Error("Test error");
      errorHandler?.(testError);

      expect(logger.error).toHaveBeenCalledWith("Redis client error:", testError);
    });

    test("should log connect events", async () => {
      const { logger } = await import("@formbricks/logger");

      // Re-import the module to trigger initialization
      await import("./redis");

      // Find the connect event handler
      const connectCall = vi.mocked(mockRedisClient.on).mock.calls.find((call) => call[0] === "connect");
      const connectHandler = connectCall?.[1];

      connectHandler?.();

      expect(logger.info).toHaveBeenCalledWith("Redis client connected");
    });

    test("should log reconnecting events", async () => {
      const { logger } = await import("@formbricks/logger");

      // Re-import the module to trigger initialization
      await import("./redis");

      // Find the reconnecting event handler
      const reconnectingCall = vi
        .mocked(mockRedisClient.on)
        .mock.calls.find((call) => call[0] === "reconnecting");
      const reconnectingHandler = reconnectingCall?.[1];

      reconnectingHandler?.();

      expect(logger.info).toHaveBeenCalledWith("Redis client reconnecting");
    });

    test("should log ready events", async () => {
      const { logger } = await import("@formbricks/logger");

      // Re-import the module to trigger initialization
      await import("./redis");

      // Find the ready event handler
      const readyCall = vi.mocked(mockRedisClient.on).mock.calls.find((call) => call[0] === "ready");
      const readyHandler = readyCall?.[1];

      readyHandler?.();

      expect(logger.info).toHaveBeenCalledWith("Redis client ready");
    });

    test("should log end events", async () => {
      const { logger } = await import("@formbricks/logger");

      // Re-import the module to trigger initialization
      await import("./redis");

      // Find the end event handler
      const endCall = vi.mocked(mockRedisClient.on).mock.calls.find((call) => call[0] === "end");
      const endHandler = endCall?.[1];

      endHandler?.();

      expect(logger.info).toHaveBeenCalledWith("Redis client disconnected");
    });
  });

  describe("Connection failure handling", () => {
    test("should handle initial connection failure", async () => {
      const { logger } = await import("@formbricks/logger");

      const connectionError = new Error("Connection failed");
      mockRedisClient.connect.mockRejectedValue(connectionError);

      vi.resetModules();
      await import("./redis");

      // Wait for the connection promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logger.error).toHaveBeenCalledWith("Initial Redis connection failed:", connectionError);
    });
  });
});
